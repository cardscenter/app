"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/actions/notification";

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

export async function getVerificationStatus() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isVerified: true, verificationStatus: true },
  });
  if (!user) return null;

  // Get latest request for reject reason
  const latestRequest = await prisma.verificationRequest.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      status: true,
      rejectReason: true,
      createdAt: true,
      reviewedAt: true,
    },
  });

  return {
    isVerified: user.isVerified,
    status: user.verificationStatus,
    rejectReason: latestRequest?.rejectReason ?? null,
    submittedAt: latestRequest?.createdAt ?? null,
    reviewedAt: latestRequest?.reviewedAt ?? null,
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
      data: {
        isVerified: decision === "APPROVED",
        verificationStatus: decision,
      },
    }),
  ]);

  // Notify user
  if (decision === "APPROVED") {
    await createNotification(
      request.userId,
      "VERIFICATION_APPROVED",
      "Account geverifieerd!",
      "Je verificatie-aanvraag is goedgekeurd. Je kunt nu zonder limiet bieden en kopen.",
      "/nl/dashboard/verificatie"
    );
  } else {
    await createNotification(
      request.userId,
      "VERIFICATION_REJECTED",
      "Verificatie afgewezen",
      reason
        ? `Je verificatie-aanvraag is afgewezen: ${reason}`
        : "Je verificatie-aanvraag is afgewezen. Je kunt een nieuwe aanvraag indienen.",
      "/nl/dashboard/verificatie"
    );
  }

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

export async function revokeVerification(userId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true },
  });
  if (admin?.accountType !== "ADMIN") return { error: "Geen toegang" };

  await prisma.user.update({
    where: { id: userId },
    data: { isVerified: false, verificationStatus: "NONE" },
  });

  await createNotification(
    userId,
    "VERIFICATION_REJECTED",
    "Verificatie ingetrokken",
    "Je accountverificatie is ingetrokken door een administrator.",
    "/nl/dashboard/verificatie"
  );

  return { success: true };
}
