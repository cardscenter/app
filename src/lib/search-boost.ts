/**
 * Zoekboost (Fase 45) — "Voorrang in zoekresultaten" voor tiers met
 * `features.searchBoost` (Unlimited / Enterprise / Admin). PRO krijgt 'm
 * bewust niet.
 *
 * Bron van waarheid is de gedenormaliseerde `User.searchBoost` (Boolean),
 * geschreven door `upgradeToTier` / `downgradeUserToFree` / admin grant+revoke
 * via `getTierDenormFields()`. `User.tierRank` is sindsdien puur informatief.
 *
 * Regel ("subtiel maar merkbaar"):
 *  - standaard-sortering "nieuwste": binnen dezelfde UTC-kalenderdag komen
 *    gebooste verkopers eerst, daarna de rest op tijd. Een boost van gisteren
 *    springt dus nooit boven een item van vandaag (geen pagina-1-dominantie).
 *  - andere sorteringen (prijs, eindigt, biedingen): boost alleen als
 *    tiebreak (`SEARCH_BOOST_TIEBREAK` in Prisma orderBy).
 *
 * SQLite/Prisma kan niet op een dag-bucket-expressie sorteren, dus de pagina's
 * halen bij "nieuwste" een kandidaat-venster op (take `BOOST_CANDIDATE_CAP`,
 * DB-gesorteerd op datum desc), sorteren in JS met `compareNewestBoosted` en
 * pagineren in JS — hetzelfde patroon als de radius-post-filter. Pagina's
 * voorbij het venster vallen terug op de gewone DB-paginering (ongeboost).
 *
 * Client-safe: geen Prisma-imports.
 */

export const BOOST_CANDIDATE_CAP = 1000;

export const SEARCH_BOOST_TIEBREAK = {
  seller: { searchBoost: "desc" as const },
};

export function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface BoostSortable {
  date: Date;
  boosted: boolean;
}

/** dag desc → geboost eerst → datum desc. */
export function compareNewestBoosted(a: BoostSortable, b: BoostSortable): number {
  const da = utcDayKey(a.date);
  const db = utcDayKey(b.date);
  if (da !== db) return da < db ? 1 : -1;
  if (a.boosted !== b.boosted) return a.boosted ? -1 : 1;
  return b.date.getTime() - a.date.getTime();
}

/**
 * Is pagina `page` (1-indexed, `pageSize` per pagina) nog volledig gedekt door
 * een kandidaat-venster van `candidateCount` rijen? Zo niet, dan moet de
 * caller terugvallen op DB-paginering (mits `totalCount > candidateCount`).
 */
export function pageWithinWindow(page: number, pageSize: number, candidateCount: number, totalCount: number): boolean {
  if (totalCount <= candidateCount) return true;
  return page * pageSize <= candidateCount;
}
