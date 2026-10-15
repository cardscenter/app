"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/admin-audit";
import { createNotification } from "@/actions/notification";
import { syncReservedBalance } from "@/lib/balance-check";
import { upgradeToTier, downgradeUserToFree } from "@/actions/subscription";
import { ACCOUNT_TIERS, type BillingCycle } from "@/lib/subscription-tiers";
import { validateUsername } from "@/lib/username-policy";
import { findUserByNameInsensitive } from "@/lib/username-policy-server";

/**
 * Support wijzigt een gebruikersnaam (sept 2026).
 *
 * De gebruiker mag zichzelf maar één keer hernoemen; daarna is dit de enige
 * route. Bedoeld voor gevallen waarin de identiteit is gecontroleerd — vandaar
 * de verplichte onderbouwing, die in het audit-log terechtkomt.
 *
 * De oude naam gaat altijd de publieke `UsernameHistory` in, ook bij een
 * support-wijziging: kopers moeten kunnen zien onder welke namen iemand
 * handelde. De eenmalige zelf-wijziging van de gebruiker wordt hier bewust
 * NIET verbruikt of teruggegeven — gebruik `forceUsernameReset` als de
 * gebruiker z'n eigen wijziging terug moet krijgen.
 */
export async function adminChangeUsername(userId: string, newNameRaw: string, reason: string) {
  const { adminId } = await requireAdmin();

  const trimmedReason = reason?.trim();
  if (!trimmedReason || trimmedReason.length < 5) {
    return { error: "Reden is verplicht (minimaal 5 tekens)" };
  }

  const newName = String(newNameRaw ?? "").trim();
  const policy = validateUsername(newName);
  if (!policy.ok) return { error: policy.error };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };
  if (user.displayName === newName) return { error: "Dit is al de huidige gebruikersnaam" };

  const existing = await findUserByNameInsensitive(newName);
  if (existing && existing.id !== userId) {
    return { error: "Deze gebruikersnaam is al in gebruik" };
  }

  const oldName = user.displayName;
  try {
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { displayName: newName } }),
      prisma.usernameHistory.create({ data: { userId, oldName } }),
    ]);
  } catch (err) {
    if ((err as { code?: string } | null)?.code === "P2002") {
      return { error: "Deze gebruikersnaam is al in gebruik" };
    }
    return { error: "Wijzigen mislukt" };
  }

  await logAdminAction({
    adminId,
    action: "ADMIN_CHANGE_USERNAME",
    targetType: "USER",
    targetId: userId,
    metadata: { oldName, newName, reason: trimmedReason },
  });

  await createNotification(
    userId,
    "ACCOUNT_UPDATE",
    "Gebruikersnaam gewijzigd door support",
    `Je gebruikersnaam is gewijzigd van @${oldName} naar @${newName}. Je vorige naam blijft zichtbaar op je profiel.`,
    "/dashboard/profiel",
  );

  revalidatePath(`/dashboard/admin/users/${userId}`);
  revalidatePath(`/spelers/${userId}`);
  return { success: true };
}

/**
 * Support wijzigt de volledige naam (voor-/achternaam).
 *
 * De gebruiker kan die zelf maar één keer invullen; daarna staat hij op slot.
 * Deze route is bedoeld voor correcties na controle van een identiteitsbewijs.
 * Beide velden leeg maken haalt het slot eraf, zodat de gebruiker de naam zelf
 * opnieuw kan invullen.
 */
export async function adminChangeFullName(
  userId: string,
  firstNameRaw: string,
  lastNameRaw: string,
  reason: string,
) {
  const { adminId } = await requireAdmin();

  const trimmedReason = reason?.trim();
  if (!trimmedReason || trimmedReason.length < 5) {
    return { error: "Reden is verplicht (minimaal 5 tekens)" };
  }

  const firstName = String(firstNameRaw ?? "").trim().slice(0, 50) || null;
  const lastName = String(lastNameRaw ?? "").trim().slice(0, 50) || null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, firstName: true, lastName: true },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };

  const hasName = firstName !== null || lastName !== null;
  await prisma.user.update({
    where: { id: userId },
    data: {
      firstName,
      lastName,
      // Leeggemaakt = slot eraf, zodat de gebruiker het zelf opnieuw invult.
      fullNameLockedAt: hasName ? new Date() : null,
    },
  });

  await logAdminAction({
    adminId,
    action: "ADMIN_CHANGE_FULL_NAME",
    targetType: "USER",
    targetId: userId,
    metadata: {
      userName: user.displayName,
      oldFirstName: user.firstName,
      oldLastName: user.lastName,
      newFirstName: firstName,
      newLastName: lastName,
      reason: trimmedReason,
    },
  });

  await createNotification(
    userId,
    "ACCOUNT_UPDATE",
    hasName ? "Naam gewijzigd door support" : "Naamveld weer vrijgegeven",
    hasName
      ? `Je naam is door support gewijzigd naar ${[firstName, lastName].filter(Boolean).join(" ")}.`
      : "Support heeft je naamveld weer vrijgegeven. Je kunt je volledige naam opnieuw invullen op je profiel.",
    "/dashboard/profiel",
  );

  revalidatePath(`/dashboard/admin/users/${userId}`);
  revalidatePath(`/spelers/${userId}`);
  return { success: true };
}

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

/**
 * Geeft de gebruiker z'n eenmalige (betaalde) naamswijziging terug.
 *
 * `lastUsernameChange` is de "verbruikt"-vlag; op null zetten betekent dat de
 * gebruiker zichzelf weer één keer mag hernoemen — tegen het normale tarief.
 * Wil je de naam zelf corrigeren? Gebruik `adminChangeUsername`.
 */
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
    "ACCOUNT_UPDATE",
    "Naamswijziging teruggegeven",
    "Support heeft je eenmalige naamswijziging teruggegeven. Je kunt je gebruikersnaam nu opnieuw wijzigen.",
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
    "ACCOUNT_UPDATE",
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

/**
 * Tier handmatig toekennen (Fase 45). Zolang Mollie-recurring-billing (Fase 17)
 * niet bestaat is dit — naast de Enterprise-aanvraag — de enige manier om een
 * account op PRO/UNLIMITED/ENTERPRISE te zetten. Loopt via `upgradeToTier`
 * (zet accountType, premiumExpiresAt, tierRank/searchBoost, quota + Subscription).
 * De tier verloopt na de gekozen cyclus via de check-subscriptions-cron.
 */
export async function grantTier(params: {
  userId: string;
  tier: "PRO" | "UNLIMITED" | "ENTERPRISE";
  billingCycle: BillingCycle;
  customMonthlyPrice?: number;
  reason: string;
}) {
  const { adminId } = await requireAdmin();
  const { userId, tier, billingCycle } = params;

  const trimmedReason = params.reason?.trim();
  if (!trimmedReason || trimmedReason.length < 5) return { error: "Reden is verplicht (min. 5 tekens)" };
  if (!(tier in ACCOUNT_TIERS) || tier === ("FREE" as string)) return { error: "Ongeldige tier" };
  if (billingCycle !== "MONTHLY" && billingCycle !== "YEARLY") return { error: "Ongeldige cyclus" };

  let customMonthlyPrice: number | undefined;
  if (params.customMonthlyPrice !== undefined) {
    if (tier !== "ENTERPRISE") return { error: "Een custom prijs kan alleen bij Enterprise" };
    if (!Number.isFinite(params.customMonthlyPrice) || params.customMonthlyPrice <= 0) {
      return { error: "Ongeldige maandprijs" };
    }
    customMonthlyPrice = Math.round(params.customMonthlyPrice * 100) / 100;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, accountType: true },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };
  // ADMIN is een rol, geen abonnement — upgradeToTier zou die rol overschrijven.
  if (user.accountType === "ADMIN") return { error: "Een admin-account kan geen tier krijgen" };

  const upgrade = await upgradeToTier(userId, tier, billingCycle, customMonthlyPrice);
  if ("error" in upgrade) return { error: upgrade.error };

  await logAdminAction({
    adminId,
    action: "GRANT_TIER",
    targetType: "USER",
    targetId: userId,
    metadata: {
      userName: user.displayName,
      previousAccountType: user.accountType,
      tier,
      billingCycle,
      monthlyPrice: customMonthlyPrice ?? ACCOUNT_TIERS[tier].monthlyPrice,
      expiresAt: upgrade.expiresAt?.toISOString() ?? null,
      reason: trimmedReason,
    },
  });

  const tierName = tier === "PRO" ? "Pro" : tier === "UNLIMITED" ? "Unlimited" : "Enterprise";
  const until = upgrade.expiresAt?.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
  await createNotification(
    userId,
    "ACCOUNT_UPDATE",
    `Abonnement ${tierName} toegekend`,
    `Je account staat nu op ${tierName}${until ? ` tot ${until}` : ""}. Alle bijbehorende voordelen zijn direct actief.`,
    "/dashboard/abonnement",
  );

  revalidatePath(`/dashboard/admin/users/${userId}`);
  revalidatePath("/dashboard/abonnement");

  return { success: true, expiresAt: upgrade.expiresAt };
}

/**
 * Tier direct intrekken → FREE (Fase 45). Zelfde reset als de expiry-cron,
 * maar de Subscription krijgt status CANCELLED + cancelledAt. Winkel-URL en
 * winkelpagina blijven bewaard (route geeft notFound tot een nieuwe upgrade).
 */
export async function revokeTier(userId: string, reason: string) {
  const { adminId } = await requireAdmin();

  const trimmedReason = reason?.trim();
  if (!trimmedReason || trimmedReason.length < 5) return { error: "Reden is verplicht (min. 5 tekens)" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, accountType: true },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };
  if (user.accountType === "ADMIN") return { error: "Een admin-account heeft geen tier om in te trekken" };
  if (user.accountType === "FREE") return { error: "Account staat al op FREE" };

  await downgradeUserToFree([userId], "CANCELLED");

  await logAdminAction({
    adminId,
    action: "REVOKE_TIER",
    targetType: "USER",
    targetId: userId,
    metadata: { userName: user.displayName, previousAccountType: user.accountType, reason: trimmedReason },
  });

  await createNotification(
    userId,
    "ACCOUNT_UPDATE",
    "Abonnement beëindigd",
    `Je account is door een admin teruggezet naar Gratis. Neem contact op met support als je hier vragen over hebt.`,
    "/dashboard/abonnement",
  );

  revalidatePath(`/dashboard/admin/users/${userId}`);
  revalidatePath("/dashboard/abonnement");

  return { success: true };
}
