"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/actions/notification";
import { logAdminAction } from "@/lib/admin-audit";
import { publish, userChannel } from "@/lib/realtime";

export async function submitVerification(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { verificationStatus: true },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };

  if (user.verificationStatus === "PENDING") {
    return { error: "Je hebt al een verificatie-aanvraag in behandeling" };
  }
  if (user.verificationStatus === "APPROVED") {
    return { error: "Je account is al geverifieerd" };
  }

  const documentType = formData.get("documentType") as string;
  const frontImageUrl = formData.get("frontImageUrl") as string;
  const backImageUrl = (formData.get("backImageUrl") as string) || null;

  if (!documentType || !frontImageUrl) {
    return { error: "Documenttype en voorkant foto zijn verplicht" };
  }

  if (!["ID_CARD", "PASSPORT", "DRIVERS_LICENSE"].includes(documentType)) {
    return { error: "Ongeldig documenttype" };
  }

  // Passport doesn't need a back image
  if (documentType !== "PASSPORT" && !backImageUrl) {
    return { error: "Achterkant foto is verplicht voor dit documenttype" };
  }

  await prisma.$transaction([
    prisma.verificationRequest.create({
      data: {
        userId: session.user.id,
        type: "ID",
        documentType,
        frontImageUrl,
        backImageUrl,
      },
    }),
    prisma.user.update({
      where: { id: session.user.id },
      data: { verificationStatus: "PENDING" },
    }),
  ]);

  return { success: true };
}

/**
 * Fase 32: adres-verificatie via officieel document (belastingdienst, energie-
 * rekening, bankafschrift, gemeentebrief). Trust-signal — geen blocker. Admin
 * controleert of naam + adres op het document overeenkomen met het profiel.
 */
const ADDRESS_DOCUMENT_TYPES = [
  "TAX_LETTER",
  "UTILITY_BILL",
  "BANK_STATEMENT",
  "MUNICIPAL_LETTER",
] as const;

export async function submitAddressVerification(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { addressVerificationStatus: true, street: true, city: true, postalCode: true },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };

  if (user.addressVerificationStatus === "PENDING") {
    return { error: "Je hebt al een adres-verificatie in behandeling" };
  }
  if (user.addressVerificationStatus === "APPROVED") {
    return { error: "Je adres is al geverifieerd" };
  }
  if (!user.street || !user.city || !user.postalCode) {
    return { error: "Vul eerst je adres in op je profiel voordat je een document indient" };
  }

  const addressDocumentType = formData.get("addressDocumentType") as string;
  const frontImageUrl = formData.get("frontImageUrl") as string;

  if (!addressDocumentType || !frontImageUrl) {
    return { error: "Documenttype en foto zijn verplicht" };
  }

  if (!ADDRESS_DOCUMENT_TYPES.includes(addressDocumentType as typeof ADDRESS_DOCUMENT_TYPES[number])) {
    return { error: "Ongeldig documenttype" };
  }

  await prisma.$transaction([
    prisma.verificationRequest.create({
      data: {
        userId: session.user.id,
        type: "ADDRESS",
        addressDocumentType,
        frontImageUrl,
      },
    }),
    prisma.user.update({
      where: { id: session.user.id },
      data: { addressVerificationStatus: "PENDING" },
    }),
  ]);

  return { success: true };
}

export async function getVerificationStatus() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      isVerified: true,
      verificationStatus: true,
      isIbanVerified: true,
      isAddressVerified: true,
      addressVerificationStatus: true,
    },
  });
  if (!user) return null;

  // Latest request per type (voor reject-reason + timestamps)
  const [latestId, latestAddress] = await Promise.all([
    prisma.verificationRequest.findFirst({
      where: { userId: session.user.id, type: "ID" },
      orderBy: { createdAt: "desc" },
      select: { status: true, rejectReason: true, createdAt: true, reviewedAt: true },
    }),
    prisma.verificationRequest.findFirst({
      where: { userId: session.user.id, type: "ADDRESS" },
      orderBy: { createdAt: "desc" },
      select: { status: true, rejectReason: true, createdAt: true, reviewedAt: true },
    }),
  ]);

  return {
    // ID (bestaand)
    isVerified: user.isVerified,
    status: user.verificationStatus,
    rejectReason: latestId?.rejectReason ?? null,
    submittedAt: latestId?.createdAt ?? null,
    reviewedAt: latestId?.reviewedAt ?? null,
    // Fase 32 — IBAN (auto via admin confirmBankTransfer, geen aparte status)
    isIbanVerified: user.isIbanVerified,
    // Fase 32 — Adres
    isAddressVerified: user.isAddressVerified,
    addressStatus: user.addressVerificationStatus,
    addressRejectReason: latestAddress?.rejectReason ?? null,
    addressSubmittedAt: latestAddress?.createdAt ?? null,
    addressReviewedAt: latestAddress?.reviewedAt ?? null,
  };
}

export async function adminReviewVerification(
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  reason?: string
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  // Verify admin
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true },
  });
  if (admin?.accountType !== "ADMIN") return { error: "Geen toegang" };

  const request = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    include: { user: { select: { id: true, displayName: true } } },
  });
  if (!request) return { error: "Aanvraag niet gevonden" };
  if (request.status !== "PENDING") return { error: "Aanvraag is al behandeld" };

  const now = new Date();

  // Fase 32: type bepaalt welk user-veld geflipt wordt.
  // ID → isVerified + verificationStatus
  // ADDRESS → isAddressVerified + addressVerificationStatus
  const isAddress = request.type === "ADDRESS";
  const userUpdate = isAddress
    ? {
        isAddressVerified: decision === "APPROVED",
        addressVerificationStatus: decision,
      }
    : {
        isVerified: decision === "APPROVED",
        verificationStatus: decision,
      };

  await prisma.$transaction([
    prisma.verificationRequest.update({
      where: { id: requestId },
      data: {
        status: decision,
        rejectReason: decision === "REJECTED" ? reason ?? null : null,
        reviewedById: session.user.id,
        reviewedAt: now,
      },
    }),
    prisma.user.update({
      where: { id: request.userId },
      data: userUpdate,
    }),
  ]);

  // Notify user — type-specifieke tekst
  const typeLabel = isAddress ? "adres" : "account";
  if (decision === "APPROVED") {
    await createNotification(
      request.userId,
      "VERIFICATION_APPROVED",
      isAddress ? "Adres geverifieerd!" : "Account geverifieerd!",
      isAddress
        ? "Je adres-verificatie is goedgekeurd. Het adres-trust-badge is nu zichtbaar op je profiel."
        : "Je verificatie-aanvraag is goedgekeurd. Je kunt nu zonder limiet bieden en kopen.",
      "/nl/dashboard/verificatie"
    );
  } else {
    await createNotification(
      request.userId,
      "VERIFICATION_REJECTED",
      isAddress ? "Adres-verificatie afgewezen" : "Verificatie afgewezen",
      reason
        ? `Je ${typeLabel}-verificatie is afgewezen: ${reason}`
        : `Je ${typeLabel}-verificatie is afgewezen. Je kunt een nieuwe aanvraag indienen.`,
      "/nl/dashboard/verificatie"
    );
  }

  await logAdminAction({
    adminId: session.user.id,
    action: "REVIEW_VERIFICATION",
    targetType: "VERIFICATION",
    targetId: requestId,
    metadata: {
      decision,
      reason: reason ?? null,
      userId: request.userId,
      userName: request.user.displayName,
    },
  });

  publish(userChannel(request.userId), {
    type: "verification-changed",
    payload: { status: decision },
  });

  return { success: true };
}

export async function getPendingVerifications() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true },
  });
  if (admin?.accountType !== "ADMIN") return [];

  return prisma.verificationRequest.findMany({
    where: { status: "PENDING" },
    include: {
      user: {
        select: { id: true, displayName: true, email: true, createdAt: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function revokeVerification(userId: string, type: "ID" | "IBAN" | "ADDRESS" = "ID") {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true },
  });
  if (admin?.accountType !== "ADMIN") return { error: "Geen toegang" };

  // Fase 32: type-specifiek intrekken — ID, IBAN of ADDRESS los van elkaar.
  const userUpdate =
    type === "ADDRESS"
      ? { isAddressVerified: false, addressVerificationStatus: "NONE" }
      : type === "IBAN"
        ? { isIbanVerified: false }
        : { isVerified: false, verificationStatus: "NONE" };

  await prisma.user.update({
    where: { id: userId },
    data: userUpdate,
  });

  const typeLabel = type === "ADDRESS" ? "Adres" : type === "IBAN" ? "Rekeningnummer" : "Account";
  await createNotification(
    userId,
    "VERIFICATION_REJECTED",
    `${typeLabel}-verificatie ingetrokken`,
    `Je ${typeLabel.toLowerCase()}-verificatie is ingetrokken door een administrator.`,
    "/nl/dashboard/verificatie"
  );

  return { success: true };
}
