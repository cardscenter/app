"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/admin-audit";
import { requireNotSuspended } from "@/lib/suspension";
import { upgradeToTier } from "@/actions/subscription";
import { createNotification } from "@/actions/notification";
import { ENTERPRISE_MIN_MONTHLY_REVENUE } from "@/lib/subscription-tiers";
import { revalidatePath } from "next/cache";

const submitSchema = z.object({
  shopName: z.string().min(2, "Winkelnaam minstens 2 tekens").max(100),
  estimatedMonthlyRevenue: z.coerce
    .number()
    .min(
      ENTERPRISE_MIN_MONTHLY_REVENUE,
      `Enterprise vereist minstens €${ENTERPRISE_MIN_MONTHLY_REVENUE.toLocaleString("nl-NL")} verkoop per maand`,
    ),
  phone: z.string().min(5, "Vul een telefoonnummer in").max(30),
  motivation: z.string().min(20, "Vertel iets over je shop (min 20 tekens)").max(2000),
});

export async function submitEnterpriseRequest(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true, displayName: true },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };

  // Geen aanvraag nodig als de user al ENTERPRISE/ADMIN is
  if (user.accountType === "ENTERPRISE" || user.accountType === "ADMIN") {
    return { error: "Je hebt al toegang tot Enterprise." };
  }

  // Eén PENDING tegelijk per user — voorkom dubbele aanvragen
  const existing = await prisma.enterpriseRequest.findFirst({
    where: { userId: session.user.id, status: "PENDING" },
    select: { id: true },
  });
  if (existing) {
    return { error: "Je hebt al een lopende aanvraag. Wacht op de reactie van het team." };
  }

  const parsed = submitSchema.safeParse({
    shopName: formData.get("shopName"),
    estimatedMonthlyRevenue: formData.get("estimatedMonthlyRevenue"),
    phone: formData.get("phone"),
    motivation: formData.get("motivation"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.enterpriseRequest.create({
    data: {
      userId: session.user.id,
      shopName: parsed.data.shopName.trim(),
      estimatedMonthlyRevenue: parsed.data.estimatedMonthlyRevenue,
      phone: parsed.data.phone.trim(),
      motivation: parsed.data.motivation.trim(),
    },
  });

  // Notify alle admin-users
  const admins = await prisma.user.findMany({
    where: { accountType: "ADMIN" },
    select: { id: true },
  });
  for (const admin of admins) {
    await createNotification(
      admin.id,
      "ADMIN_TASK",
      "Nieuwe Enterprise-aanvraag",
      `${user.displayName} heeft een Enterprise-aanvraag ingediend (€${parsed.data.estimatedMonthlyRevenue.toLocaleString("nl-NL")}/m).`,
      "/dashboard/admin/enterprise-requests",
    );
  }

  revalidatePath("/dashboard/abonnement");
  revalidatePath("/dashboard/abonnement/enterprise-aanvraag");

  return { success: true };
}

export async function approveEnterpriseRequest(params: {
  requestId: string;
  monthlyPrice: number;
  billingCycle: "MONTHLY" | "YEARLY";
}) {
  const { adminId } = await requireAdmin();

  const request = await prisma.enterpriseRequest.findUnique({
    where: { id: params.requestId },
    select: { id: true, userId: true, status: true, shopName: true },
  });
  if (!request) return { error: "Aanvraag niet gevonden" };
  if (request.status !== "PENDING") return { error: "Aanvraag is al beoordeeld" };
  if (params.monthlyPrice <= 0) return { error: "Prijs moet groter zijn dan 0" };

  // Tier-flip via bestaande upgradeToTier helper (die zet ook tierRank +
  // freeUpsellsRemaining + premiumExpiresAt + Subscription-record).
  const upgrade = await upgradeToTier(
    request.userId,
    "ENTERPRISE",
    params.billingCycle,
    params.monthlyPrice,
  );
  if ("error" in upgrade) return { error: upgrade.error };

  await prisma.enterpriseRequest.update({
    where: { id: request.id },
    data: {
      status: "APPROVED",
      reviewedAt: new Date(),
      reviewedById: adminId,
      approvedMonthlyPrice: params.monthlyPrice,
    },
  });

  await createNotification(
    request.userId,
    "ACCOUNT_UPDATE",
    "Enterprise-aanvraag goedgekeurd",
    `Je Enterprise-aanvraag voor ${request.shopName} is goedgekeurd. Tarief: €${params.monthlyPrice.toLocaleString("nl-NL")}/maand. Welkom bij Enterprise.`,
    "/dashboard/abonnement",
  );

  await logAdminAction({
    adminId,
    action: "APPROVE_ENTERPRISE_REQUEST",
    targetType: "ENTERPRISE_REQUEST",
    targetId: request.id,
    metadata: { monthlyPrice: params.monthlyPrice, billingCycle: params.billingCycle, userId: request.userId },
  });

  revalidatePath("/dashboard/admin/enterprise-requests");
  revalidatePath("/dashboard/admin");

  return { success: true };
}

export async function rejectEnterpriseRequest(params: {
  requestId: string;
  rejectionReason: string;
}) {
  const { adminId } = await requireAdmin();

  if (params.rejectionReason.trim().length < 5) {
    return { error: "Reden minstens 5 tekens" };
  }

  const request = await prisma.enterpriseRequest.findUnique({
    where: { id: params.requestId },
    select: { id: true, userId: true, status: true, shopName: true },
  });
  if (!request) return { error: "Aanvraag niet gevonden" };
  if (request.status !== "PENDING") return { error: "Aanvraag is al beoordeeld" };

  await prisma.enterpriseRequest.update({
    where: { id: request.id },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
      reviewedById: adminId,
      rejectionReason: params.rejectionReason.trim(),
    },
  });

  await createNotification(
    request.userId,
    "ACCOUNT_UPDATE",
    "Enterprise-aanvraag afgewezen",
    `Je Enterprise-aanvraag voor ${request.shopName} is afgewezen. Reden: ${params.rejectionReason.trim()}`,
    "/dashboard/abonnement",
  );

  await logAdminAction({
    adminId,
    action: "REJECT_ENTERPRISE_REQUEST",
    targetType: "ENTERPRISE_REQUEST",
    targetId: request.id,
    metadata: { reason: params.rejectionReason.trim(), userId: request.userId },
  });

  revalidatePath("/dashboard/admin/enterprise-requests");
  revalidatePath("/dashboard/admin");

  return { success: true };
}

export async function getMyPendingEnterpriseRequest(): Promise<{
  id: string;
  shopName: string;
  createdAt: Date;
} | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const r = await prisma.enterpriseRequest.findFirst({
    where: { userId: session.user.id, status: "PENDING" },
    select: { id: true, shopName: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return r;
}
