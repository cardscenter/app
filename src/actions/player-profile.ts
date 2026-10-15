"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireNotSuspended } from "@/lib/suspension";
import { normalizeEmail } from "@/lib/validations/auth";
import { ageOn, isMinor, isPlausibleDateOfBirth, parseDateOfBirth } from "@/lib/age";
import { parseFavoriteGames, parsePlayerIds, validatePlayerId } from "@/lib/games";
import { listGames } from "@/lib/games-server";
import { sendGuardianConsentEmail } from "@/lib/email/send-email";

const GUARDIAN_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const GUARDIAN_MAIL_MIN_INTERVAL_MS = 10 * 60 * 1000;
const PHONE_RE = /^\+?[0-9 ()-]{8,20}$/;

/**
 * Spelersgegevens (Community Hub, Fase 2): geboortedatum, favoriete spellen,
 * spelers-ID's en (onder 16) het ouder-/noodcontact. De geboortedatum is
 * nooit publiek; alleen de leeftijdsdivisie wordt getoond.
 *
 * Wisselt de geboortedatum van "ouder dan 16" naar "jonger dan 16", dan
 * vervalt een eerder gegeven ouder-toestemming niet (die hoorde bij de
 * ouder, niet bij de datum). Wisselt het ouder-e-mailadres, dan wél: de
 * toestemming is aan dat adres gegeven.
 */
export async function updatePlayerProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  const userId = session.user.id;

  const suspended = await requireNotSuspended(userId);
  if ("error" in suspended) return { error: suspended.error };

  // Geboortedatum
  const dobRaw = (formData.get("dateOfBirth") as string | null) ?? "";
  let dateOfBirth: Date | null = null;
  if (dobRaw.trim()) {
    dateOfBirth = parseDateOfBirth(dobRaw);
    if (!dateOfBirth) return { error: "Ongeldige geboortedatum" };
    if (!isPlausibleDateOfBirth(dateOfBirth)) return { error: "Controleer je geboortedatum" };
  }

  // Favoriete spellen + spelers-ID's (alleen aangezette spellen tellen)
  const games = await listGames();
  const enabledKeys = games.filter((g) => g.enabled).map((g) => g.key);
  const favoriteGames = Array.from(
    new Set(formData.getAll("favoriteGames").filter((v): v is string => typeof v === "string" && enabledKeys.includes(v))),
  );
  const playerIds: Record<string, string> = {};
  for (const g of games) {
    if (!g.playerIdLabel) continue;
    const raw = formData.get(`playerId:${g.key}`);
    if (typeof raw !== "string") continue;
    const check = validatePlayerId(raw);
    if (!check.ok) return { error: `${g.playerIdLabel}: ${check.error}` };
    if (check.value) playerIds[g.key] = check.value;
  }

  // Ouder/noodcontact
  const guardianName = ((formData.get("guardianName") as string | null) ?? "").trim().slice(0, 100) || null;
  const guardianEmailRaw = ((formData.get("guardianEmail") as string | null) ?? "").trim();
  const guardianEmail = guardianEmailRaw ? normalizeEmail(guardianEmailRaw) : null;
  const guardianPhone = ((formData.get("guardianPhone") as string | null) ?? "").trim() || null;
  if (guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail)) {
    return { error: "Ongeldig e-mailadres van je ouder" };
  }
  if (guardianPhone && !PHONE_RE.test(guardianPhone)) {
    return { error: "Ongeldig telefoonnummer (8 tot 20 cijfers)" };
  }

  const minor = dateOfBirth ? isMinor(dateOfBirth) : false;
  if (minor) {
    if (!guardianPhone) return { error: "Onder de 16 is een telefoonnummer van een ouder of noodcontact verplicht" };
    if (!guardianEmail) return { error: "Onder de 16 hebben we het e-mailadres van een ouder nodig voor de toestemming" };
  }

  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { guardianEmail: true, guardianConsentAt: true },
  });
  if (!current) return { error: "Gebruiker niet gevonden" };
  const guardianChanged = (current.guardianEmail ?? null) !== (guardianEmail ?? null);

  await prisma.user.update({
    where: { id: userId },
    data: {
      dateOfBirth,
      favoriteGames: JSON.stringify(favoriteGames),
      playerIds: JSON.stringify(playerIds),
      guardianName,
      guardianEmail,
      guardianPhone,
      // Toestemming hoort bij het ouder-adres: nieuw adres = opnieuw vragen.
      ...(guardianChanged ? { guardianConsentAt: null } : {}),
    },
  });

  revalidatePath("/dashboard/profiel");
  return { success: true, minor, needsConsent: minor && (guardianChanged || !current.guardianConsentAt) };
}

/**
 * Stuurt (opnieuw) de toestemmingsmail naar de ouder. Max 1 per 10 minuten.
 */
export async function requestGuardianConsent() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, dateOfBirth: true, guardianName: true, guardianEmail: true, guardianConsentAt: true },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };
  if (!user.dateOfBirth || !isMinor(user.dateOfBirth)) return { error: "Toestemming is alleen nodig onder de 16" };
  if (!user.guardianEmail) return { error: "Vul eerst het e-mailadres van je ouder in en sla op" };
  if (user.guardianConsentAt) return { error: "De toestemming is al gegeven" };

  const recent = await prisma.guardianConsentToken.findFirst({
    where: { userId, createdAt: { gt: new Date(Date.now() - GUARDIAN_MAIL_MIN_INTERVAL_MS) } },
    select: { id: true },
  });
  if (recent) return { error: "Er is net een mail verstuurd. Probeer het over 10 minuten opnieuw." };

  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.guardianConsentToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.guardianConsentToken.create({
      data: { userId, guardianEmail: user.guardianEmail, token, expiresAt: new Date(Date.now() + GUARDIAN_TOKEN_TTL_MS) },
    }),
  ]);

  void sendGuardianConsentEmail({
    to: user.guardianEmail,
    guardianName: user.guardianName,
    childDisplayName: user.displayName,
    token,
  }).catch((err) => console.error("[guardian-consent] mail faalde:", err));

  return { success: true, email: user.guardianEmail };
}

/** Alleen leeftijd + divisie-info voor de UI (nooit de datum zelf naar buiten). */
export async function getOwnAgeInfo(): Promise<{ age: number | null; minor: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { age: null, minor: false };
  const u = await prisma.user.findUnique({ where: { id: session.user.id }, select: { dateOfBirth: true } });
  if (!u?.dateOfBirth) return { age: null, minor: false };
  return { age: ageOn(u.dateOfBirth), minor: isMinor(u.dateOfBirth) };
}

export type PlayerProfileSnapshot = {
  dateOfBirth: string;
  favoriteGames: string[];
  playerIds: Record<string, string>;
};

/** Helper voor server-pages: velden in form-vorm. */
export async function readPlayerProfile(raw: {
  dateOfBirth: Date | null;
  favoriteGames: string | null;
  playerIds: string | null;
}): Promise<PlayerProfileSnapshot> {
  const games = await listGames();
  const keys = games.map((g) => g.key);
  return {
    dateOfBirth: raw.dateOfBirth ? raw.dateOfBirth.toISOString().slice(0, 10) : "",
    favoriteGames: parseFavoriteGames(raw.favoriteGames, keys),
    playerIds: parsePlayerIds(raw.playerIds, keys),
  };
}
