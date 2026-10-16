"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveUploadedFile } from "@/lib/upload";
import { isValidIbanFormat, normalizeIban, IBAN_COOLDOWN_DAYS } from "@/lib/validations/iban";
import { decryptIban, encryptIban } from "@/lib/iban-crypto";
import { EMAIL_PREF_CATEGORIES, parseEmailPreferences } from "@/lib/email/preferences-config";
import { requireTotpStepUp } from "@/lib/two-factor";
import { validateUsername, validateSlugTerms, RESERVED_EXACT } from "@/lib/username-policy";
import {
  USERNAME_CHANGE_FEE,
  USERNAME_CHANGE_TX_TYPE,
  getUsernameChangeState,
  isCaseOnlyRename,
} from "@/lib/username-change-config";
import { requireNotSuspended } from "@/lib/suspension";
import { isFeatureVisibleFor } from "@/lib/feature-flags";
import { createNotification } from "@/actions/notification";
import { publish, userChannel } from "@/lib/realtime";
import { findUserByNameInsensitive } from "@/lib/username-policy-server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { convertToBusinessSchema } from "@/lib/validations/shop";
import { MAX_SOCIAL_LINKS } from "@/lib/events/socials";

// De gebruikersnaam zit bewust NIET in dit schema: hernoemen is een aparte,
// betaalde en eenmalige handeling (zie `changeUsername`). Zo kan een bio-edit
// nooit per ongeluk €2,99 kosten of de naam op slot zetten.
const profileSchema = z.object({
  bio: z.string().max(500).optional(),
  websiteUrl: z.string().max(200).optional(),
  // Volledige naam (profiel-redesign sept 2026) — primair op de site, de
  // gebruikersnaam wordt de @handle. Leeg toegestaan voor legacy-accounts.
  firstName: z.string().trim().max(50).optional(),
  lastName: z.string().trim().max(50).optional(),
});

/** Alleen eigen upload-paden (via /api/upload) of leeg — geen externe URL's. */
const UPLOAD_URL_RE = /^\/api\/uploads\/[A-Za-z0-9._-]+$/;

/**
 * Website/social-URL normaliseren: "cardscenter.nl" → "https://cardscenter.nl".
 * Retourneert null bij een lege string, undefined bij een ongeldige URL.
 */
function normalizeHttpUrl(raw: string): string | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "https:" && u.protocol !== "http:") return undefined;
    if (!u.hostname.includes(".")) return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

export async function updateProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const result = profileSchema.safeParse({
    bio: formData.get("bio") || undefined,
    websiteUrl: (formData.get("websiteUrl") as string | null) ?? undefined,
    firstName: (formData.get("firstName") as string | null) ?? undefined,
    lastName: (formData.get("lastName") as string | null) ?? undefined,
  });

  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const { bio } = result.data;
  const firstName = result.data.firstName?.trim() || null;
  const lastName = result.data.lastName?.trim() || null;

  // Website + socials (profiel-redesign sept 2026). Socials komen als
  // herhaalde FormData-key "socialLinks" binnen; lege regels overslaan.
  const websiteUrl = normalizeHttpUrl(result.data.websiteUrl ?? "");
  if (websiteUrl === undefined) {
    return { error: "Ongeldige website-URL" };
  }
  const socialLinks: string[] = [];
  for (const raw of formData.getAll("socialLinks")) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    const normalized = normalizeHttpUrl(raw);
    if (normalized === undefined) {
      return { error: `Ongeldige social-link: ${raw.trim()}` };
    }
    if (normalized && !socialLinks.includes(normalized)) socialLinks.push(normalized);
  }
  if (socialLinks.length > MAX_SOCIAL_LINKS) {
    return { error: `Maximaal ${MAX_SOCIAL_LINKS} social-links` };
  }

  // Omslagfoto: de client uploadt 'm al via /api/upload (context "cover",
  // gemodereerd) en stuurt alleen het pad mee. Leeg = verwijderen.
  const coverRaw = formData.get("coverImageUrl");
  let coverImageUrl: string | null | undefined;
  if (typeof coverRaw === "string") {
    const trimmed = coverRaw.trim();
    if (trimmed === "") coverImageUrl = null;
    else if (UPLOAD_URL_RE.test(trimmed)) coverImageUrl = trimmed;
    else return { error: "Ongeldige omslagfoto" };
  }

  // Volledige naam is eenmalig invulbaar. Zodra hij ooit is opgeslagen staat
  // hij vast en kan alleen support hem nog wijzigen (na een geldig ID-bewijs).
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { firstName: true, lastName: true, fullNameLockedAt: true },
  });
  if (!currentUser) return { error: "Gebruiker niet gevonden" };

  const fullNameLocked = currentUser.fullNameLockedAt !== null;
  // Bij een slot negeren we wat de client stuurt en houden we de opgeslagen
  // waarde aan — verdedigt tegen een handmatig samengestelde POST.
  const nextFirstName = fullNameLocked ? currentUser.firstName : firstName;
  const nextLastName = fullNameLocked ? currentUser.lastName : lastName;
  // Pas op slot zodra er echt iets is ingevuld: een leeg veld opslaan mag de
  // naam niet voorgoed vastzetten.
  const lockFullNameNow =
    !fullNameLocked && (nextFirstName !== null || nextLastName !== null);

  // Handle avatar upload
  let avatarUrl: string | undefined;
  const removeAvatar = formData.get("removeAvatar") === "true";

  if (removeAvatar) {
    avatarUrl = "";
  } else {
    const avatarFile = formData.get("avatarFile") as File | null;
    if (avatarFile && avatarFile.size > 0) {
      try {
        avatarUrl = await saveUploadedFile(avatarFile, {
          context: "avatar",
          userId: session.user.id,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (message.startsWith("MODERATION_BLOCKED:")) {
          const reason = message.slice("MODERATION_BLOCKED:".length).trim();
          return {
            error: `Deze profielfoto voldoet niet aan onze richtlijnen${reason ? `: ${reason}` : "."}`,
          };
        }
        return { error: "Profielfoto uploaden mislukt. Maximaal 5MB (JPG, PNG, WebP)." };
      }
    }
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      firstName: nextFirstName,
      lastName: nextLastName,
      ...(lockFullNameNow && { fullNameLockedAt: new Date() }),
      bio: bio ?? null,
      websiteUrl,
      socialLinks: socialLinks.length > 0 ? JSON.stringify(socialLinks) : null,
      ...(coverImageUrl !== undefined && { coverImageUrl }),
      ...(avatarUrl !== undefined && { avatarUrl: avatarUrl || null }),
    },
    select: { avatarUrl: true },
  });

  revalidatePath(`/spelers/${session.user.id}`);

  return { success: true, avatarUrl: updated.avatarUrl };
}

/**
 * Gebruikersnaam wijzigen — eenmalig en betaald.
 *
 * Beleid (zie `username-change-config.ts`): elke gebruiker mag zichzelf
 * precies één keer hernoemen voor {@link USERNAME_CHANGE_FEE} uit het saldo.
 * Daarna staat de naam vast en kan alleen support hem nog wijzigen, na
 * controle van een geldig identiteitsbewijs (`adminChangeUsername`).
 *
 * De oude naam wordt altijd in `UsernameHistory` vastgelegd en is publiek
 * zichtbaar op het profiel — een handelsnaam kan dus nooit spoorloos
 * verdwijnen.
 *
 * Bewust een aparte action i.p.v. onderdeel van `updateProfile`: zo kan een
 * bio- of avatar-wijziging nooit per ongeluk geld kosten.
 */
export async function changeUsername(newNameRaw: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  const userId = session.user.id;

  // Community Hub (Fase 1): de eenmalige wijziging kost saldo; zonder
  // FEATURE_WALLET kan alleen support (admin) de naam nog aanpassen.
  if (!isFeatureVisibleFor("FEATURE_WALLET", session.user.accountType)) {
    return { error: "Je gebruikersnaam wijzigen is tijdelijk niet mogelijk. Neem contact op met support." };
  }

  try {
    await requireNotSuspended(userId);
  } catch {
    return { error: "Je account is opgeschort" };
  }

  const newName = String(newNameRaw ?? "").trim();
  if (!newName) return { error: "Vul een gebruikersnaam in" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      displayName: true,
      lastUsernameChange: true,
      balance: true,
      reservedBalance: true,
    },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };

  if (user.displayName === newName) {
    return { error: "Dit is al je gebruikersnaam" };
  }

  // Alleen een andere schrijfwijze van dezelfde handle: gratis, verbruikt de
  // eenmalige wijziging niet en komt niet in de historie. Bewust géén
  // policy-check — legacy-namen die inmiddels op de blocklist staan moeten
  // hun hoofdletters kunnen bijstellen.
  if (isCaseOnlyRename(user.displayName, newName)) {
    await prisma.user.update({ where: { id: userId }, data: { displayName: newName } });
    revalidatePath("/dashboard/profiel");
    revalidatePath(`/spelers/${userId}`);
    return { success: true, charged: 0 };
  }

  const state = getUsernameChangeState(user.lastUsernameChange);
  if (!state.canChange) {
    return {
      error:
        "Je hebt je gebruikersnaam al eens gewijzigd. Neem contact op met support als hij echt moet veranderen — dat kan alleen met een geldig identiteitsbewijs.",
    };
  }

  const policy = validateUsername(newName);
  if (!policy.ok) return { error: policy.error };

  const existing = await findUserByNameInsensitive(newName);
  if (existing && existing.id !== userId) {
    return { error: "Deze gebruikersnaam is al in gebruik" };
  }

  const available = user.balance - user.reservedBalance;
  if (available < USERNAME_CHANGE_FEE) {
    return {
      error: `Je hebt €${USERNAME_CHANGE_FEE.toFixed(2).replace(".", ",")} beschikbaar saldo nodig om je gebruikersnaam te wijzigen.`,
    };
  }

  const oldName = user.displayName;
  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.user.findUnique({
        where: { id: userId },
        select: { balance: true, reservedBalance: true },
      });
      if (!fresh) throw new Error("USERNAME_CHANGE_FAILED");

      // Claim-first: de where-clause dekt zowel "nog niet verbruikt" als
      // "saldo toereikend", dus twee gelijktijdige verzoeken kunnen nooit
      // beide slagen of dubbel afschrijven.
      const claimed = await tx.user.updateMany({
        where: {
          id: userId,
          lastUsernameChange: null,
          balance: { gte: USERNAME_CHANGE_FEE },
        },
        data: {
          displayName: newName,
          lastUsernameChange: now,
          balance: { decrement: USERNAME_CHANGE_FEE },
        },
      });
      if (claimed.count === 0) throw new Error("USERNAME_CHANGE_FAILED");

      await tx.usernameHistory.create({
        data: { userId, oldName, changedAt: now },
      });

      const balanceBefore = fresh.balance;
      const balanceAfter = Math.round((balanceBefore - USERNAME_CHANGE_FEE) * 100) / 100;
      await tx.transaction.create({
        data: {
          userId,
          type: USERNAME_CHANGE_TX_TYPE,
          amount: -USERNAME_CHANGE_FEE,
          balanceBefore,
          balanceAfter,
          description: `Gebruikersnaam gewijzigd: @${oldName} → @${newName}`,
        },
      });
    });
  } catch (err) {
    // Unieke index op displayName kan alsnog klappen bij een gelijktijdige
    // registratie met dezelfde naam.
    const code = (err as { code?: string } | null)?.code;
    if (code === "P2002") return { error: "Deze gebruikersnaam is al in gebruik" };
    return { error: "Wijzigen mislukt. Probeer het opnieuw." };
  }

  await createNotification(
    userId,
    "ACCOUNT_UPDATE",
    "Gebruikersnaam gewijzigd",
    `Je gebruikersnaam is gewijzigd van @${oldName} naar @${newName}. Er is €${USERNAME_CHANGE_FEE.toFixed(2).replace(".", ",")} van je saldo afgeschreven. Je vorige naam blijft zichtbaar op je profiel.`,
    "/dashboard/profiel",
  );
  publish(userChannel(userId), { type: "balance-changed", payload: {} });

  revalidatePath("/dashboard/profiel");
  revalidatePath(`/spelers/${userId}`);

  return { success: true, charged: USERNAME_CHANGE_FEE };
}

export async function updateProfileBanner(bannerKey: string | null) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  // Validate that bannerKey is a valid seller level nameKey (or null to remove)
  if (bannerKey !== null) {
    const { SELLER_LEVELS } = await import("@/lib/seller-levels");
    const validKeys = SELLER_LEVELS.map((l) => l.nameKey);
    if (!validKeys.includes(bannerKey)) {
      return { error: "Ongeldige banner" };
    }

    // Check if user has unlocked this tier
    const { getSellerStats } = await import("@/actions/review");
    const stats = await getSellerStats(session.user.id);
    if (!stats) return { error: "Kan verkopersstats niet ophalen" };

    const { getLevel } = await import("@/lib/seller-levels");
    const currentLevel = getLevel(stats.xp);
    const currentLevelIndex = SELLER_LEVELS.findIndex((l) => l.nameKey === currentLevel.nameKey);
    const requestedLevelIndex = SELLER_LEVELS.findIndex((l) => l.nameKey === bannerKey);

    if (requestedLevelIndex > currentLevelIndex) {
      return { error: "Je hebt deze rank nog niet bereikt" };
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { profileBanner: bannerKey },
  });

  return { success: true };
}

const bankDetailsSchema = z.object({
  iban: z.string().min(1, "IBAN is verplicht"),
  accountHolderName: z.string().min(2, "Naam rekeninghouder is verplicht").max(100),
});

export async function updateBankDetails(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  // Step-up 2FA (Fase 16-followup): bankgegevens wijzigen is de voorbereidende
  // stap van geld wegsluizen — code vereist tenzij dit apparaat vertrouwd is.
  const stepUp = await requireTotpStepUp(
    session.user.id,
    formData.get("totpCode") as string | null,
  );
  if (stepUp === "code_required") {
    return { totpRequired: true as const, error: "Bevestig deze wijziging met je 2FA-code." };
  }
  if (stepUp === "invalid") {
    return { totpRequired: true as const, error: "Ongeldige 2FA-code. Probeer opnieuw." };
  }

  const result = bankDetailsSchema.safeParse({
    iban: formData.get("iban"),
    accountHolderName: formData.get("accountHolderName"),
  });
  if (!result.success) return { error: result.error.issues[0].message };

  const iban = normalizeIban(result.data.iban);
  if (!isValidIbanFormat(iban)) {
    return { error: "Ongeldig IBAN-formaat" };
  }
  const accountHolderName = result.data.accountHolderName.trim();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { iban: true, accountHolderName: true, lastIbanChange: true },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };

  // Fase 6: IBAN staat versleuteld in de DB; vergelijken op de platte waarde.
  const currentIban = decryptIban(user.iban);

  // No-op early return: nothing to save.
  if (currentIban === iban && user.accountHolderName === accountHolderName) {
    return { success: true, unchanged: true };
  }

  // First-time set is free; subsequent changes are cooldown-capped. We only
  // gate IBAN changes (not name-only edits) since the name doesn't change
  // where the money lands. If both fields change, we treat it as an IBAN
  // change for cooldown purposes.
  const isIbanChange = currentIban !== null && currentIban !== iban;
  if (isIbanChange && user.lastIbanChange) {
    const daysSince = (Date.now() - user.lastIbanChange.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < IBAN_COOLDOWN_DAYS) {
      const daysRemaining = Math.ceil(IBAN_COOLDOWN_DAYS - daysSince);
      return {
        error: `Je kunt je IBAN pas over ${daysRemaining} dag${daysRemaining === 1 ? "" : "en"} weer wijzigen.`,
        daysRemaining,
      };
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      iban: encryptIban(iban),
      accountHolderName,
      ...(isIbanChange ? { lastIbanChange: new Date() } : {}),
    },
  });

  return { success: true };
}

export async function updateMaxRunnerUpAttempts(value: number) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  if (!Number.isInteger(value) || value < 0 || value > 3) {
    return { error: "Waarde moet tussen 0 en 3 liggen" };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { maxRunnerUpAttempts: value },
  });

  return { success: true };
}

// Vanity shop-slug (Fase 31/45). Alleen Unlimited+/Enterprise/Admin mogen
// een slug claimen. /winkel/<slug> is sinds Fase 45 een echte winkelpagina.
// Bij downgrade blijft de slug bewaard maar de /winkel/-route stopt (notFound).
// Fase 43: route-specifieke lijst blijft, ge-unioned met de gedeelde
// RESERVED_EXACT uit username-policy; rol-termen/scheldwoorden via
// validateSlugTerms in updateShopSlug.
const SHOP_SLUG_RESERVED = new Set([
  "admin", "login", "register", "dashboard", "api", "winkel", "verkoper",
  "marktplaats", "veilingen", "claimsales", "berichten", "winkelwagen",
  "zoeken", "uploads", "customization", "abonnement", "saldo", "profiel",
  "support", "help", "about", "contact", "test", "settings",
  ...RESERVED_EXACT,
]);

const shopSlugSchema = z
  .string()
  .min(3, "Minimaal 3 tekens")
  .max(32, "Maximaal 32 tekens")
  .regex(/^[a-z0-9-]+$/, "Alleen kleine letters, cijfers en koppelteken toegestaan")
  .refine((s) => !s.startsWith("-") && !s.endsWith("-"), "Mag niet beginnen of eindigen met een koppelteken")
  .refine((s) => !SHOP_SLUG_RESERVED.has(s), "Deze naam is gereserveerd");

// Bid-confirmation preference (Fase 31). True = modal nooit tonen,
// bid wordt direct geplaatst. Default false = standaard modal voor
// eerste bod per veiling (per-veiling tracking client-side via
// localStorage). Geen suspension-check — een geschorste user kan deze
// preference toch wijzigen.
export async function updateBidConfirmationPreference(skip: boolean) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { skipBidConfirmation: skip },
  });

  return { success: true };
}

// E-mailnotificatie-voorkeuren (Fase 16). Accepteert alleen bekende
// categorie-keys; onbekende keys worden genegeerd. Geen suspension-check —
// mail-voorkeuren aanpassen mag altijd.
export async function updateEmailPreferences(prefs: Record<string, boolean>) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailPreferences: true },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };

  const merged = parseEmailPreferences(user.emailPreferences);
  for (const { key } of EMAIL_PREF_CATEGORIES) {
    if (typeof prefs[key] === "boolean") merged[key] = prefs[key];
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { emailPreferences: JSON.stringify(merged) },
  });

  return { success: true };
}

export async function updateShopSlug(rawSlug: string | null) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true, shopSlug: true },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };

  // Tier-gate: alleen Unlimited+/Enterprise/Admin
  const allowed = ["UNLIMITED", "ENTERPRISE", "ADMIN"].includes(user.accountType);
  if (!allowed) {
    return { error: "Eigen winkel-URL is alleen beschikbaar voor Unlimited en Enterprise" };
  }

  // Lege string of null = slug verwijderen
  if (rawSlug === null || rawSlug.trim() === "") {
    if (user.shopSlug === null) return { success: true, unchanged: true };
    await prisma.user.update({
      where: { id: session.user.id },
      data: { shopSlug: null },
    });
    return { success: true, slug: null };
  }

  const slug = rawSlug.trim().toLowerCase();
  const parsed = shopSlugSchema.safeParse(slug);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Fase 43 — rol-termen en scheldwoorden gelden ook voor winkel-URL's
  // ("official-cards" wekt vals vertrouwen).
  const slugTerms = validateSlugTerms(slug);
  if (!slugTerms.ok) return { error: "Deze winkel-URL is niet toegestaan" };

  if (user.shopSlug === slug) return { success: true, unchanged: true };

  // Uniqueness pre-check (sneller foutmelding dan @unique-violation catch)
  const taken = await prisma.user.findUnique({ where: { shopSlug: slug }, select: { id: true } });
  if (taken && taken.id !== session.user.id) {
    return { error: "Deze winkel-URL is al in gebruik" };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { shopSlug: slug },
  });

  return { success: true, slug };
}

/**
 * Particulier → bedrijf (Fase 45). Eerste schrijfpad voor bedrijfsgegevens;
 * one-way en zonder admin-review. Ontgrendelt de bedrijfspagina-modus van de
 * winkelpagina (galerij, standplaats, openingstijden, KvK/btw-regel).
 */
export async function convertToBusinessAccount(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountKind: true },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };
  if (user.accountKind === "BUSINESS") return { success: true, unchanged: true };

  const parsed = convertToBusinessSchema.safeParse({
    companyName: formData.get("companyName") ?? "",
    cocNumber: formData.get("cocNumber") ?? "",
    vatNumber: formData.get("vatNumber") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldige gegevens" };

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      accountKind: "BUSINESS",
      companyName: parsed.data.companyName,
      cocNumber: parsed.data.cocNumber,
      vatNumber: parsed.data.vatNumber || null,
    },
  });

  revalidatePath("/dashboard/winkel");
  revalidatePath("/dashboard/profiel");
  return { success: true };
}
