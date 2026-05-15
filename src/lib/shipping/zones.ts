/**
 * Verzendzone-bepaling op basis van origin + destination country (Fase 33).
 *
 * EU_NEAR is realistische handelspartners, niet "elke geografische buur". Voor NL bv. alleen BE.
 * Mapping is symmetrisch — gegenereerd at-build-time uit één-richting-array zodat onderhoudsfouten
 * (vergeten tegenrichting toe te voegen) uitgesloten zijn.
 */

import { COUNTRY_CODES } from "./countries";
import type { ShippingZone } from "./tariffs";

/** Eén-richting-array. Symmetrische `EU_NEAR_NEIGHBORS` wordt hieruit afgeleid. */
const EU_NEAR_PRIMARY_PARTNERS: Record<string, string[]> = {
  NL: ["BE"],
  BE: ["FR"],
  DE: ["AT"],
  FR: ["ES"],
  LU: ["BE", "FR", "DE"],
  DK: ["SE"],
  SE: ["FI"],
  FI: ["EE"],
  IT: ["FR", "AT"],
  ES: ["PT"],
  PL: ["DE", "CZ"],
  CZ: ["SK"],
  SK: ["HU"],
  HU: ["AT", "RO"],
  RO: ["BG"],
  BG: ["GR"],
  HR: ["SI"],
  SI: ["AT"],
  EE: ["LV"],
  LV: ["LT"],
  LT: ["PL"],
  // origins zonder primary partners: AT, IE, GR, PT, MT, CY (mapping wordt door symmetrie gevuld)
};

/** Symmetrische buurland-mapping, gegenereerd uit EU_NEAR_PRIMARY_PARTNERS. */
export const EU_NEAR_NEIGHBORS: Record<string, ReadonlySet<string>> = (() => {
  const map: Record<string, Set<string>> = {};
  for (const code of COUNTRY_CODES) map[code] = new Set();
  for (const [origin, partners] of Object.entries(EU_NEAR_PRIMARY_PARTNERS)) {
    for (const partner of partners) {
      map[origin]?.add(partner);
      map[partner]?.add(origin);
    }
  }
  const result: Record<string, ReadonlySet<string>> = {};
  for (const [k, v] of Object.entries(map)) result[k] = v;
  return result;
})();

/** Bepaal de verzendzone tussen origin en destination.
 *  Returnt null voor niet-EU bestemmingen (blokkeert checkout). */
export function zoneFor(originCountry: string, destinationCountry: string): ShippingZone | null {
  if (!COUNTRY_CODES.includes(originCountry) || !COUNTRY_CODES.includes(destinationCountry)) {
    return null;
  }
  if (originCountry === destinationCountry) return "DOMESTIC";
  if (EU_NEAR_NEIGHBORS[originCountry]?.has(destinationCountry)) return "EU_NEAR";
  return "EU_FAR";
}

/** Heeft een origin überhaupt EU_NEAR-buurlanden? Bepaalt of de "+ buurlanden"-optie
 *  zichtbaar is in de selling-scope-toggle. */
export function hasEuNearNeighbors(originCountry: string): boolean {
  return (EU_NEAR_NEIGHBORS[originCountry]?.size ?? 0) > 0;
}

/** Lijst van EU_NEAR-buurlanden voor een origin (alfabetisch). Voor display in UI. */
export function getEuNearNeighbors(originCountry: string): string[] {
  return Array.from(EU_NEAR_NEIGHBORS[originCountry] ?? []).sort();
}
