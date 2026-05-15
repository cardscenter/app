"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/admin-audit";
import { createNotification } from "@/actions/notification";
import { syncReservedBalance } from "@/lib/balance-check";

export async function resetIbanCooldown(userId: string) {
  const { adminId } = await requireAdmin();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, lastIbanChange: true },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };

  await prisma.user.update({
    where: { id: userId },
    data: { lastIbanChange: null },
  });

  await logAdminAction({
    adminId,
    action: "RESET_IBAN_COOLDOWN",
    targetType: "USER",
    targetId: userId,
    metadata: { userName: user.displayName, previousLastIbanChange: user.lastIbanChange?.toISOString() ?? null },
  });

  return { success: true };
}

export async function forceUsernameReset(userId: string) {
  const { adminId } = await requireAdmin();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, lastUsernameChange: true },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };

  await prisma.user.update({
    where: { id: userId },
    data: { lastUsernameChange: null },
  });

  await logAdminAction({
    adminId,
    action: "FORCE_USERNAME_RESET",
    targetType: "USER",
    targetId: userId,
    metadata: { userName: user.displayName, previousLastUsernameChange: user.lastUsernameChange?.toISOString() ?? null },
  });

  await createNotification(
    userId,
    "NEW_MESSAGE",
    "Username-cooldown gereset",
    "Een admin heeft je username-cooldown gereset. Je kunt nu opnieuw je gebruikersnaam wijzigen.",
    "/dashboard/profiel"
  );

  return { success: true };
}

/**
 * Borg-vrijstelling toekennen of intrekken (Fase 29).
 *
 * Effect: bij `exempt=true` mag de gebruiker bids ≥ €2500 plaatsen zonder
 * een geverifieerd ID-document. Borg-forfait blijft van toepassing bij
 * wanbetaling — de vrijstelling beschermt alleen tegen de verified-eis.
 *
 * Bedoeld voor zakelijke accounts met valide vatNumber + cocNumber. UI
 * verbergt de knop voor INDIVIDUAL-accounts; backend valideert opnieuw.
 */
export async function setBidDepositExemption(
  userId: string,
  exempt: boolean,
  reason: string,
) {
  const { adminId } = await requireAdmin();

  const trimmedReason = reason?.trim();
  if (!trimmedReason) return { error: "Reden is verplicht" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      displayName: true,
      accountKind: true,
      vatNumber: true,
      cocNumber: true,
      isBusinessBidExempt: true,
    },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };

  // Backend-guard: alleen BUSINESS-accounts mogen vrijstelling krijgen.
  // INDIVIDUAL kan via de UI niet, maar dubbel-checken.
  if (exempt && user.accountKind !== "BUSINESS") {
    return { error: "Borg-vrijstelling is alleen mogelijk voor BUSINESS-accounts" };
  }
  if (exempt && (!user.vatNumber || !user.cocNumber)) {
    return { error: "BUSINESS-account moet zowel BTW-nummer als KVK-nummer hebben ingevuld" };
  }
  if (user.isBusinessBidExempt === exempt) {
    return { error: `Vrijstelling staat al op ${exempt ? "actief" : "inactief"}` };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isBusinessBidExempt: exempt },
  });

  await logAdminAction({
    adminId,
    action: exempt ? "GRANT_BID_DEPOSIT_EXEMPTION" : "REVOKE_BID_DEPOSIT_EXEMPTION",
    targetType: "USER",
    targetId: userId,
    metadata: { userName: user.displayName, reason: trimmedReason },
  });

  await createNotification(
    userId,
    "NEW_MESSAGE",
    exempt ? "Borg-vrijstelling toegekend" : "Borg-vrijstelling ingetrokken",
    exempt
      ? "Je BUSINESS-account is door een admin vrijgesteld van de verified-eis voor bids ≥ €2500. Borg-forfait bij wanbetaling blijft van toepassing."
      : "Je borg-vrijstelling is door een admin ingetrokken. Voor bids ≥ €2500 heb je opnieuw een geverifieerd account nodig.",
    "/dashboard/profiel",
  );

  return { success: true };
}

/**
 * Forceer de reservedBalance van een user op de live-herberekening.
 *
 * Bedoeld voor admin-troubleshooting: als de DB-waarde uit de pas loopt met de
 * werkelijke active bids + AWAITING_PAYMENT-winners (bv. door een legacy-
 * rekenfout of een edge-case die we niet hebben afgevangen) kan een admin
 * deze knop drukken om het op te lossen zonder een Prisma-script te draaien.
 *
 * Veilig: roept gewoon `syncReservedBalance` aan dat onder de motorkap
 * `recalculateTotalReserved` doet (zelfde logica als de bid-flow zelf).
 */
export async function syncUserReservedBalance(userId: string) {
  const { adminId } = await requireAdmin();

  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, reservedBalance: true },
  });
  if (!before) return { error: "Gebruiker niet gevonden" };

  const newReserved = await syncReservedBalance(userId);
  const previousReserved = before.reservedBalance;
  const delta = Math.round((newReserved - previousReserved) * 100) / 100;

  await logAdminAction({
    adminId,
    action: "SYNC_RESERVED_BALANCE",
    targetType: "USER",
    targetId: userId,
    metadata: {
      userName: before.displayName,
      previousReserved,
      newReserved,
      delta,
    },
  });

  revalidatePath(`/dashboard/admin/users/${userId}`);

  return { success: true, previousReserved, newReserved, delta };
}
