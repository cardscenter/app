"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { creditBalance, deductBalance } from "@/actions/wallet";
import { requireNotSuspended } from "@/lib/suspension";
import { revalidatePath } from "next/cache";
import {
  calculateClaimsaleUpsellCost,
  CLAIMSALE_UPSELL_TYPES_OFFERED,
  type ClaimsaleUpsellType,
} from "@/lib/upsell-config";

const DAY_MS = 24 * 60 * 60 * 1000;

// Post-publicatie promotie-beheer voor claimsales. Anders dan veilingen/listings
// (waar upsells alleen bij aanmaken gezet worden) kan de seller hier op een
// live/geplande claimsale promotie bijkopen, toevoegen of vroegtijdig stoppen.
// Claimsales hebben geen vaste einddatum, dus verlengen is een natuurlijke flow.

async function loadOwnedClaimsale(claimsaleId: string, userId: string) {
  const claimsale = await prisma.claimsale.findUnique({
    where: { id: claimsaleId },
    select: { id: true, sellerId: true, status: true, startTime: true, title: true },
  });
  if (!claimsale) return { error: "Claimsale niet gevonden" } as const;
  if (claimsale.sellerId !== userId) return { error: "Niet geautoriseerd" } as const;
  if (claimsale.status !== "LIVE" && claimsale.status !== "SCHEDULED") {
    return { error: "Promotie kan alleen op een actieve of geplande claimsale" } as const;
  }
  return { claimsale } as const;
}

/**
 * Dagen bijkopen op een bestaande upsell. Volledig betaald — free-quota geldt
 * alleen op het aanmaak-moment.
 */
export async function extendClaimsaleUpsell(upsellId: string, extraDays: number) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  const userId = session.user.id;

  const susp = await requireNotSuspended(userId);
  if ("error" in susp) return { error: susp.error };

  const days = Math.floor(extraDays);
  if (!Number.isFinite(days) || days < 1 || days > 30) {
    return { error: "Kies tussen 1 en 30 extra dagen" };
  }

  const upsell = await prisma.claimsaleUpsell.findUnique({ where: { id: upsellId } });
  if (!upsell) return { error: "Promotie niet gevonden" };

  const owned = await loadOwnedClaimsale(upsell.claimsaleId, userId);
  if ("error" in owned) return owned;

  const seller = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountType: true, balance: true, reservedBalance: true },
  });
  const accountType = seller?.accountType ?? "FREE";
  const cost = calculateClaimsaleUpsellCost(upsell.type as ClaimsaleUpsellType, days, accountType);
  const available = (seller?.balance ?? 0) - (seller?.reservedBalance ?? 0);
  if (cost > available) return { error: "Onvoldoende saldo om te verlengen" };

  // Verleng vanaf de huidige expiresAt — of vanaf nu als 'ie al verlopen was.
  const base = upsell.expiresAt > new Date() ? upsell.expiresAt : new Date();
  const newExpiresAt = new Date(base.getTime() + days * DAY_MS);
  const newTotalCost = Math.round((upsell.totalCost + cost) * 100) / 100;
  const totalDays = Math.max(
    1,
    Math.round((newExpiresAt.getTime() - upsell.startsAt.getTime()) / DAY_MS)
  );

  await prisma.claimsaleUpsell.update({
    where: { id: upsellId },
    data: {
      expiresAt: newExpiresAt,
      totalCost: newTotalCost,
      dailyCost: Math.round((newTotalCost / totalDays) * 100) / 100,
    },
  });

  if (cost > 0) {
    await deductBalance(userId, cost, "UPSELL", `Promotie verlengen claimsale: ${owned.claimsale.title}`);
  }

  revalidatePath(`/nl/claimsales/${upsell.claimsaleId}`);
  return { success: true };
}

/**
 * Een upsell-type toevoegen dat nog niet actief is op de claimsale.
 */
export async function addClaimsaleUpsell(
  claimsaleId: string,
  type: string,
  days: number
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  const userId = session.user.id;

  const susp = await requireNotSuspended(userId);
  if ("error" in susp) return { error: susp.error };

  if (!CLAIMSALE_UPSELL_TYPES_OFFERED.includes(type as ClaimsaleUpsellType)) {
    return { error: "Onbekend promotie-type" };
  }
  const upsellType = type as ClaimsaleUpsellType;
  const d = Math.floor(days);
  if (!Number.isFinite(d) || d < 1 || d > 30) {
    return { error: "Kies tussen 1 en 30 dagen" };
  }

  const owned = await loadOwnedClaimsale(claimsaleId, userId);
  if ("error" in owned) return owned;

  // Weiger als er al een actieve upsell van dit type loopt — anders krijg je
  // twee overlappende rijen.
  const now = new Date();
  const existing = await prisma.claimsaleUpsell.findFirst({
    where: { claimsaleId, type: upsellType, expiresAt: { gt: now } },
  });
  if (existing) return { error: "Deze promotie loopt al — gebruik 'Verlengen'" };

  const seller = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountType: true, balance: true, reservedBalance: true },
  });
  const accountType = seller?.accountType ?? "FREE";
  const cost = calculateClaimsaleUpsellCost(upsellType, d, accountType);
  const available = (seller?.balance ?? 0) - (seller?.reservedBalance ?? 0);
  if (cost > available) return { error: "Onvoldoende saldo voor deze promotie" };

  // SCHEDULED: promotie start pas wanneer de claimsale live gaat.
  const startsAt =
    owned.claimsale.status === "SCHEDULED" && owned.claimsale.startTime
      ? owned.claimsale.startTime
      : now;

  await prisma.claimsaleUpsell.create({
    data: {
      claimsaleId,
      type: upsellType,
      startsAt,
      expiresAt: new Date(startsAt.getTime() + d * DAY_MS),
      dailyCost: Math.round((cost / d) * 100) / 100,
      totalCost: cost,
    },
  });

  if (cost > 0) {
    await deductBalance(userId, cost, "UPSELL", `Promotie claimsale: ${owned.claimsale.title}`);
  }

  revalidatePath(`/nl/claimsales/${claimsaleId}`);
  return { success: true };
}

/**
 * Een upsell vroegtijdig stoppen. Pro-rata refund van de ongebruikte tijd;
 * idempotent — een al-verlopen upsell levert €0 op en wordt niet dubbel
 * gerefund.
 */
export async function cancelClaimsaleUpsell(upsellId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  const userId = session.user.id;

  const upsell = await prisma.claimsaleUpsell.findUnique({ where: { id: upsellId } });
  if (!upsell) return { error: "Promotie niet gevonden" };

  const owned = await loadOwnedClaimsale(upsell.claimsaleId, userId);
  if ("error" in owned) return owned;

  const now = new Date();
  const refund = refundClaimsaleUpsellAmount(upsell, now);

  // Race-safe: zet expiresAt alleen terug als 'ie nog in de toekomst lag.
  // Als count===0 was 'ie al gestopt → geen (dubbele) refund.
  const stopped = await prisma.claimsaleUpsell.updateMany({
    where: { id: upsellId, expiresAt: { gt: now } },
    data: { expiresAt: now },
  });
  if (stopped.count === 0) {
    return { success: true, refundedAmount: 0 };
  }

  if (refund > 0) {
    await creditBalance(
      userId,
      refund,
      "UPSELL_REFUND",
      `Refund gestopte promotie claimsale "${owned.claimsale.title}"`
    );
  }

  revalidatePath(`/nl/claimsales/${upsell.claimsaleId}`);
  return { success: true, refundedAmount: refund };
}

// Pure pro-rata-berekening: ongebruikte tijd × totalCost. Gratis upsells
// (totalCost === 0) leveren €0 op.
function refundClaimsaleUpsellAmount(
  upsell: { startsAt: Date; expiresAt: Date; totalCost: number },
  now: Date
): number {
  if (upsell.totalCost <= 0) return 0;
  if (now <= upsell.startsAt) return upsell.totalCost;
  if (now >= upsell.expiresAt) return 0;
  const totalMs = upsell.expiresAt.getTime() - upsell.startsAt.getTime();
  const remainingMs = upsell.expiresAt.getTime() - now.getTime();
  const ratio = totalMs > 0 ? remainingMs / totalMs : 0;
  return Math.round(upsell.totalCost * ratio * 100) / 100;
}
