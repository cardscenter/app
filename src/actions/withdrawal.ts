"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deductBalance, creditBalance } from "@/actions/wallet";
import { createNotification } from "@/actions/notification";
import { WITHDRAWAL_MIN_AMOUNT } from "@/lib/withdrawal-config";
import { z } from "zod";

const requestSchema = z.object({
  amount: z.coerce.number().min(WITHDRAWAL_MIN_AMOUNT, `Minimaal €${WITHDRAWAL_MIN_AMOUNT}`),
});

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" as const };
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true },
  });
  if (user?.accountType !== "ADMIN") return { error: "Niet geautoriseerd" as const };
  return { adminId: session.user.id };
}

export async function requestWithdrawal(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const parsed = requestSchema.safeParse({ amount: formData.get("amount") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const amount = Math.round(parsed.data.amount * 100) / 100;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      balance: true,
      reservedBalance: true,
      iban: true,
      accountHolderName: true,
    },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };

  if (!user.iban || !user.accountHolderName) {
    return { error: "Vul eerst je bankgegevens in via Dashboard → Profiel." };
  }

  const available = user.balance - user.reservedBalance;
  if (amount > available) {
    return { error: `Onvoldoende beschikbaar saldo. Beschikbaar: €${available.toFixed(2)}.` };
  }

  // One active request at a time — keeps the queue + accounting honest.
  const existing = await prisma.withdrawalRequest.findFirst({
    where: {
      userId: session.user.id,
      status: { in: ["PENDING", "APPROVED"] },
    },
  });
  if (existing) {
    return { error: "Je hebt al een openstaande uitbetalingsaanvraag." };
  }

  // Deduct from balance immediately so the same money can't be spent twice
  // while admin processes the request. Refund happens on REJECTED.
  await deductBalance(
    session.user.id,
    amount,
    "WITHDRAWAL",
    `Uitbetalingsaanvraag (€${amount.toFixed(2)})`
  );

  await prisma.withdrawalRequest.create({
    data: {
      userId: session.user.id,
      amount,
      iban: user.iban,
      accountHolderName: user.accountHolderName,
      status: "PENDING",
    },
  });

  return { success: true };
}

export async function getMyWithdrawals() {
  const session = await auth();
  if (!session?.user?.id) return [];
  return prisma.withdrawalRequest.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
}

export async function getActiveWithdrawal() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.withdrawalRequest.findFirst({
    where: {
      userId: session.user.id,
      status: { in: ["PENDING", "APPROVED"] },
    },
  });
}

// ============================================================
// ADMIN ACTIONS
// ============================================================

export async function getAllWithdrawals(filter?: "PENDING" | "APPROVED" | "PAID" | "REJECTED") {
  const adm = await requireAdmin();
  if ("error" in adm) return [];

  return prisma.withdrawalRequest.findMany({
    where: filter ? { status: filter } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, displayName: true, email: true } },
      reviewedBy: { select: { displayName: true } },
    },
  });
}

export async function approveWithdrawal(withdrawalId: string, adminNote?: string) {
  const adm = await requireAdmin();
  if ("error" in adm) return { error: adm.error };

  const w = await prisma.withdrawalRequest.findUnique({ where: { id: withdrawalId } });
  if (!w) return { error: "Aanvraag niet gevonden" };
  if (w.status !== "PENDING") return { error: `Aanvraag is al ${w.status}` };

  await prisma.withdrawalRequest.update({
    where: { id: withdrawalId },
    data: {
      status: "APPROVED",
      reviewedById: adm.adminId,
      approvedAt: new Date(),
      adminNote: adminNote?.trim() || null,
    },
  });

  await createNotification(
    w.userId,
    "ITEM_SOLD",
    "Uitbetaling goedgekeurd",
    `Je uitbetaling van €${w.amount.toFixed(2)} is goedgekeurd. De overboeking wordt binnenkort uitgevoerd.`,
    "/nl/dashboard/uitbetalingen"
  );

  return { success: true };
}

export async function markWithdrawalPaid(withdrawalId: string) {
  const adm = await requireAdmin();
  if ("error" in adm) return { error: adm.error };

  const w = await prisma.withdrawalRequest.findUnique({ where: { id: withdrawalId } });
  if (!w) return { error: "Aanvraag niet gevonden" };
  if (w.status !== "APPROVED") return { error: "Alleen goedgekeurde aanvragen kunnen als betaald gemarkeerd worden" };

  await prisma.withdrawalRequest.update({
    where: { id: withdrawalId },
    data: {
      status: "PAID",
      paidAt: new Date(),
    },
  });

  await createNotification(
    w.userId,
    "ITEM_SOLD",
    "Uitbetaling voltooid",
    `Je uitbetaling van €${w.amount.toFixed(2)} is overgemaakt naar ${w.iban.slice(0, 4)} **** ${w.iban.slice(-4)}.`,
    "/nl/dashboard/uitbetalingen"
  );

  return { success: true };
}

export async function rejectWithdrawal(withdrawalId: string, reason: string) {
  const adm = await requireAdmin();
  if ("error" in adm) return { error: adm.error };

  const trimmed = reason?.trim();
  if (!trimmed) return { error: "Reden is verplicht" };

  const w = await prisma.withdrawalRequest.findUnique({ where: { id: withdrawalId } });
  if (!w) return { error: "Aanvraag niet gevonden" };
  if (w.status === "PAID") return { error: "Een betaalde aanvraag kan niet worden afgewezen" };
  if (w.status === "REJECTED") return { error: "Aanvraag is al afgewezen" };

  // Refund the held balance back to the user.
  await creditBalance(
    w.userId,
    w.amount,
    "WITHDRAWAL_REFUND",
    `Uitbetalingsaanvraag afgewezen: ${trimmed}`
  );

  await prisma.withdrawalRequest.update({
    where: { id: withdrawalId },
    data: {
      status: "REJECTED",
      reviewedById: adm.adminId,
      rejectedAt: new Date(),
      rejectReason: trimmed,
    },
  });

  await createNotification(
    w.userId,
    "ITEM_SOLD",
    "Uitbetaling afgewezen",
    `Je uitbetaling van €${w.amount.toFixed(2)} is afgewezen: ${trimmed}. Het bedrag is teruggestort op je saldo.`,
    "/nl/dashboard/uitbetalingen"
  );

  return { success: true };
}
