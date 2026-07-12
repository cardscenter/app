/**
 * E-mailnotificatie-voorkeuren (Fase 16).
 *
 * Client-importable config-bestand — GEEN "use server" en geen server-only
 * imports, zodat de voorkeuren-UI de categorieën en defaults kan renderen
 * (zelfde patroon als withdrawal-config.ts / address-cooldown.ts).
 *
 * De "account"-categorie staat bewust NIET in de toggles: schorsingen,
 * verificatie-uitslagen en admin-ingrepen worden altijd gemaild.
 */

export const EMAIL_PREF_CATEGORIES = [
  {
    key: "orders",
    label: "Bestellingen & verkopen",
    description:
      "Betalingen, verzonden pakketten, verkochte items, annuleringen en betaaltermijnen.",
  },
  {
    key: "bids",
    label: "Biedingen",
    description:
      "Wanneer je overboden wordt op een veiling (maximaal 1 mail per veiling per uur).",
  },
  {
    key: "messages",
    label: "Berichten",
    description:
      "Wanneer een chatbericht na 15 minuten nog ongelezen is. Ben je actief op de site, dan krijg je geen mail.",
  },
  {
    key: "disputes",
    label: "Geschillen",
    description: "Updates over geopende geschillen en hun afhandeling.",
  },
  {
    key: "events",
    label: "Evenementen",
    description:
      "Goedkeuring van je events en standhouder-aanvragen op de evenementenkalender.",
  },
] as const;

export type EmailPrefCategory = (typeof EMAIL_PREF_CATEGORIES)[number]["key"];

/** Categorie inclusief de altijd-aan "account"-groep (voor logging/dispatch). */
export type EmailCategory = EmailPrefCategory | "account";

export type EmailPreferences = Record<EmailPrefCategory, boolean>;

export const DEFAULT_EMAIL_PREFERENCES: EmailPreferences = {
  orders: true,
  bids: true,
  messages: true,
  disputes: true,
  events: true,
};

/**
 * Parse de JSON-blob uit User.emailPreferences naar een volledig object.
 * Onbekende keys worden genegeerd, ontbrekende keys vallen terug op default
 * (aan). Null/corrupte JSON = alle defaults.
 */
export function parseEmailPreferences(json: string | null | undefined): EmailPreferences {
  const prefs = { ...DEFAULT_EMAIL_PREFERENCES };
  if (!json) return prefs;
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    for (const { key } of EMAIL_PREF_CATEGORIES) {
      if (typeof parsed[key] === "boolean") prefs[key] = parsed[key] as boolean;
    }
  } catch {
    // Corrupte JSON → defaults; bewust stil (geen user-facing impact).
  }
  return prefs;
}

/**
 * Map een notificatie-type (de vrije string uit createNotification) naar een
 * mail-categorie. Return:
 *   - "account"  → altijd mailen, niet uitschakelbaar
 *   - toggle-key → mailen als de user de categorie aan heeft
 *   - null       → nooit mailen (admin-werk zit in het admin-panel)
 */
export function notificationTypeToCategory(type: string): EmailCategory | null {
  // Nooit mailen: admin-queues hebben het admin-panel.
  if (type === "ADMIN_TASK" || type === "EVENT_PENDING_REVIEW") return null;

  // Altijd aan.
  if (
    type === "ACCOUNT_UPDATE" ||
    type === "VERIFICATION_APPROVED" ||
    type === "VERIFICATION_REJECTED" ||
    type === "TRUSTED_ORGANIZER"
  ) {
    return "account";
  }

  if (type === "OUTBID") return "bids";
  if (type.startsWith("DISPUTE_")) return "disputes";
  if (type.startsWith("EVENT_")) return "events";

  if (
    type.startsWith("ORDER_") ||
    type.startsWith("BUYBACK_") ||
    type === "ITEM_SOLD" ||
    type === "AUCTION_WIN" ||
    type === "AUCTION_WON" ||
    type === "NEW_MESSAGE" // catch-all: annuleringen, betaaltermijnen, proposals, pickup
  ) {
    return "orders";
  }

  // Onbekend type → geen mail. Nieuwe types bewust hier toevoegen.
  return null;
}

/**
 * Types die een dedupe-throttle krijgen (max 1 mail per dedupeKey per uur).
 * OUTBID: biedoorlog mag de inbox niet volspammen.
 * NEW_MESSAGE: catch-all die in flows soms meerdere keren kort na elkaar vuurt.
 */
export const THROTTLED_TYPES = new Set(["OUTBID", "NEW_MESSAGE"]);

export const EMAIL_THROTTLE_MINUTES = 60;

/** Chat-mail: pas mailen als het bericht zo oud is en nog ongelezen. */
export const CHAT_UNREAD_EMAIL_DELAY_MINUTES = 15;

/** EmailLog-rijen ouder dan dit worden opgeruimd door de cron. */
export const EMAIL_LOG_RETENTION_DAYS = 90;
