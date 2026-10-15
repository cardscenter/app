/**
 * Feature-flags (Community Hub, Fase 1).
 *
 * De handelsfuncties van de oude marktplaats (claimsales, marktplaats,
 * veilingen, app-saldo) zijn verborgen achter server-side flags. Ze zijn
 * standaard UIT; alleen een expliciete `true`/`1`/`on` in de env zet ze aan.
 * Admins (`accountType === "ADMIN"`) zien de functies altijd, zodat er
 * getest kan worden zonder de flag voor iedereen om te zetten.
 *
 * Dit bestand is bewust puur: geen Prisma, geen auth, geen Next-imports.
 * Daardoor is het veilig te importeren in `src/proxy.ts` (middleware),
 * `src/instrumentation.ts`, client-components én unit-tests. De server-
 * helpers (redirect/404/action-guard) staan in `feature-flags-server.ts`.
 *
 * `requires`: handel zonder geld kan niet, dus de drie handel-flags vereisen
 * `FEATURE_WALLET`. Staat WALLET uit, dan zijn ze effectief uit, ook als hun
 * eigen env-var aan staat.
 */

export const FEATURE_FLAG_KEYS = [
  "FEATURE_WALLET",
  "FEATURE_AUCTIONS",
  "FEATURE_CLAIMSALES",
  "FEATURE_MARKETPLACE",
  "FEATURE_COMMUNITY_EVENTS",
] as const;

export type FeatureFlag = (typeof FEATURE_FLAG_KEYS)[number];

export interface FeatureFlagMeta {
  label: string;
  description: string;
  /** Flags die óók aan moeten staan voordat deze flag effectief aan is. */
  requires?: readonly FeatureFlag[];
}

export const FEATURE_FLAGS: Record<FeatureFlag, FeatureFlagMeta> = {
  FEATURE_WALLET: {
    label: "Saldo en geld",
    description:
      "App-saldo, storten, uitbetalen, bestellingen/verzending/geschillen, abonnementen, Ember en cosmetics, winkelpagina, statistieken.",
  },
  FEATURE_AUCTIONS: {
    label: "Veilingen",
    description: "Veilingen, bieden, autobid, Live Hub, volglijst.",
    requires: ["FEATURE_WALLET"],
  },
  FEATURE_CLAIMSALES: {
    label: "Claimsales",
    description: "Claimsales, claimen en de winkelwagen.",
    requires: ["FEATURE_WALLET"],
  },
  FEATURE_MARKETPLACE: {
    label: "Marktplaats",
    description: "Advertenties, voorstellen, bundel-aanbod, ophalen, winkelpagina.",
    requires: ["FEATURE_WALLET"],
  },
  FEATURE_COMMUNITY_EVENTS: {
    label: "Community-evenementen",
    description:
      "Door leden ingediende beurzen en events in heel Europa (kaart, geocoding, standhouders, goedkeuring). Uit = alleen winkel-events van Cards Center.",
  },
};

export type FlagEnv = Readonly<Record<string, string | undefined>>;

function envOn(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "true" || v === "1" || v === "on";
}

/**
 * Staat de flag aan? Leest de env (default `process.env`), default uit.
 * Volgt de `requires`-keten: een flag is pas aan als al z'n vereisten aan zijn.
 */
export function isFeatureEnabled(flag: FeatureFlag, env: FlagEnv = process.env): boolean {
  const seen = new Set<FeatureFlag>();
  const check = (f: FeatureFlag): boolean => {
    if (seen.has(f)) return true; // cyclus-guard; komt in de registry niet voor
    seen.add(f);
    if (!envOn(env[f])) return false;
    const requires = FEATURE_FLAGS[f].requires ?? [];
    return requires.every(check);
  };
  return check(flag);
}

/**
 * Mag deze bezoeker de functie zien/gebruiken? Aan voor iedereen zodra de
 * flag aan staat; anders alleen voor admins (testen zonder de flag om te zetten).
 */
export function isFeatureVisibleFor(
  flag: FeatureFlag,
  accountType: string | null | undefined,
  env: FlagEnv = process.env,
): boolean {
  if (isFeatureEnabled(flag, env)) return true;
  return accountType === "ADMIN";
}

export type FeatureSnapshot = Record<FeatureFlag, boolean>;

/** Per-bezoeker snapshot voor de client-provider (`useFeatureFlags`). */
export function getFeatureSnapshot(
  accountType: string | null | undefined,
  env: FlagEnv = process.env,
): FeatureSnapshot {
  const out = {} as FeatureSnapshot;
  for (const flag of FEATURE_FLAG_KEYS) {
    out[flag] = isFeatureVisibleFor(flag, accountType, env);
  }
  return out;
}

/** Alle flags uit — handig als default in client-context vóór hydratie. */
export function emptyFeatureSnapshot(): FeatureSnapshot {
  const out = {} as FeatureSnapshot;
  for (const flag of FEATURE_FLAG_KEYS) out[flag] = false;
  return out;
}

/** Is er minstens één handel-flag zichtbaar (claimsales/marktplaats/veilingen)? */
export function anyTradeFeatureVisible(
  accountType: string | null | undefined,
  env: FlagEnv = process.env,
): boolean {
  return (["FEATURE_AUCTIONS", "FEATURE_CLAIMSALES", "FEATURE_MARKETPLACE"] as const).some((f) =>
    isFeatureVisibleFor(f, accountType, env),
  );
}

/** Foutmelding voor server actions die een uitgeschakelde functie raken. */
export const FEATURE_DISABLED_ERROR = "Deze functie is tijdelijk niet beschikbaar.";
