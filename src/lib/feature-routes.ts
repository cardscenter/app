/**
 * Pad-prefix → feature-flag. Gebruikt door `src/proxy.ts` (snelle redirect
 * vóór de pagina rendert) en door de tests. De page-layouts met
 * `createFeatureLayout` blijven de autoritatieve guard; dit is de snelle weg.
 *
 * Paden zijn locale-loos (`/veilingen`, niet `/nl/veilingen`). Een prefix
 * matcht op exact het pad of op `prefix/...`. Langste prefix wint, zodat een
 * eventuele uitzondering onder een gegate boom later toegevoegd kan worden.
 *
 * Puur bestand: geen Next-/Prisma-imports.
 */
import type { FeatureFlag } from "./feature-flags";

export const FEATURE_ROUTE_PREFIXES: ReadonlyArray<readonly [string, FeatureFlag]> = [
  // Veilingen
  ["/veilingen", "FEATURE_AUCTIONS"],
  ["/dashboard/veilingen", "FEATURE_AUCTIONS"],
  ["/dashboard/biedingen", "FEATURE_AUCTIONS"],
  ["/dashboard/volglijst", "FEATURE_AUCTIONS"],
  // Claimsales (+ winkelwagen, die alleen claimsale-items bevat)
  ["/claimsales", "FEATURE_CLAIMSALES"],
  ["/winkelwagen", "FEATURE_CLAIMSALES"],
  ["/dashboard/claimsales", "FEATURE_CLAIMSALES"],
  // Marktplaats
  ["/marktplaats", "FEATURE_MARKETPLACE"],
  ["/dashboard/marktplaats", "FEATURE_MARKETPLACE"],
  // Saldo en alles wat eraan hangt
  ["/dashboard/saldo", "FEATURE_WALLET"],
  ["/dashboard/uitbetalingen", "FEATURE_WALLET"],
  ["/dashboard/abonnement", "FEATURE_WALLET"],
  ["/dashboard/verzending", "FEATURE_WALLET"],
  ["/dashboard/verkopen", "FEATURE_WALLET"],
  ["/dashboard/aankopen", "FEATURE_WALLET"],
  ["/dashboard/geschillen", "FEATURE_WALLET"],
  ["/dashboard/geschillen-v2", "FEATURE_WALLET"],
  ["/dashboard/statistieken", "FEATURE_WALLET"],
  ["/dashboard/winkel", "FEATURE_WALLET"],
  ["/winkel", "FEATURE_WALLET"],
  ["/customization", "FEATURE_WALLET"],
  ["/dashboard/reviews", "FEATURE_WALLET"],
  // Rang en XP (geparkeerd tot de league in Fase 5)
  ["/dashboard/level", "FEATURE_XP"],
  // Community-beurzenkalender (door leden ingediend, Europa) — de winkel-events
  // van de hub leven op /evenementen en zijn altijd zichtbaar.
  ["/beurzen", "FEATURE_COMMUNITY_EVENTS"],
  ["/dashboard/beurzen", "FEATURE_COMMUNITY_EVENTS"],
  // Kaartendatabase (komt terug met de handel; de verkoopcalculator houdt
  // z'n prijzen via /api/cards/search)
  ["/kaarten", "FEATURE_CARD_DATABASE"],
  ["/pokedex", "FEATURE_CARD_DATABASE"],
];

const LOCALE_PREFIX = /^\/(nl|en)(?=\/|$)/;

/** Strip `/nl` of `/en` van het pad; `/nl` → `/`. */
export function stripLocale(pathname: string): string {
  const stripped = pathname.replace(LOCALE_PREFIX, "");
  return stripped === "" ? "/" : stripped;
}

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + "/");
}

/**
 * Welke flag beschermt dit pad? `null` als het pad vrij is.
 * Accepteert zowel locale-geprefixte als kale paden.
 */
export function featureForPath(pathname: string): FeatureFlag | null {
  const path = stripLocale(pathname);
  let best: { len: number; flag: FeatureFlag } | null = null;
  for (const [prefix, flag] of FEATURE_ROUTE_PREFIXES) {
    if (matchesPrefix(path, prefix) && (!best || prefix.length > best.len)) {
      best = { len: prefix.length, flag };
    }
  }
  return best?.flag ?? null;
}
