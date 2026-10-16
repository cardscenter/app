import "server-only";
import { prisma } from "@/lib/prisma";
import { BULK_PRICING, BULK_CATEGORY_TOOLTIPS, type BulkGroup, type BulkTier } from "@/lib/buyback-pricing";

/**
 * Bulk-inkooptarieven uit de database (Community Hub, Fase 6). De vaste tabel
 * `BULK_PRICING` is alleen nog de seed; admins wijzigen prijzen, namen en
 * zichtbaarheid op /dashboard/admin/buyback-pricing. Tien seconden cache per
 * proces; `invalidateBulkPricingCache` na elke wijziging.
 */

export interface BulkPriceRow {
  key: string;
  name: string;
  nameEn: string;
  description: string | null;
  price: number;
  group: BulkGroup;
  tier: BulkTier;
  weightGrams: number;
  sortOrder: number;
  enabled: boolean;
}

// Seed-namen uit de bestaande i18n-keys (buyback.<labelKey>), hier plat zodat
// de seed geen next-intl nodig heeft.
const SEED_NAMES: Record<string, { nl: string; en: string }> = {
  commonUncommon: { nl: "Common / Uncommon", en: "Common / Uncommon" },
  rare: { nl: "Rare", en: "Rare" },
  holo: { nl: "Holo Rare", en: "Holo Rare" },
  reverseHolo: { nl: "Reverse Holo", en: "Reverse Holo" },
  ultraRare: { nl: "Ultra Rare en hoger", en: "Ultra Rare and up" },
  pokeballReverse: { nl: "Poké Ball Reverse", en: "Poké Ball Reverse" },
  masterBallReverse: { nl: "Master Ball Reverse", en: "Master Ball Reverse" },
  oversizedCard: { nl: "Jumbo kaart", en: "Oversized card" },
  codeCard: { nl: "Codekaart", en: "Code card" },
  coin: { nl: "Munt", en: "Coin" },
  sleeves: { nl: "Sleeves (sealed, 65 st.)", en: "Sleeves (sealed, 65 pcs)" },
  energy: { nl: "Energy (sealed pakje)", en: "Energy (sealed pack)" },
};

let seeded = false;
export async function ensureBulkPricing(): Promise<void> {
  if (seeded) return;
  if ((await prisma.bulkPriceCategory.count()) === 0) {
    let i = 0;
    for (const [key, cfg] of Object.entries(BULK_PRICING)) {
      const names = SEED_NAMES[cfg.labelKey] ?? { nl: key, en: key };
      await prisma.bulkPriceCategory.create({
        data: {
          key,
          name: names.nl,
          nameEn: names.en,
          description: BULK_CATEGORY_TOOLTIPS[key as keyof typeof BULK_PRICING] ?? null,
          price: cfg.price,
          group: cfg.group,
          tier: cfg.tier,
          weightGrams: cfg.weightGrams,
          sortOrder: (i += 10),
        },
      });
    }
  }
  seeded = true;
}

const TTL_MS = 10_000;
let cache: { at: number; rows: BulkPriceRow[] } | null = null;

export async function getBulkPricing(opts: { includeDisabled?: boolean } = {}): Promise<BulkPriceRow[]> {
  await ensureBulkPricing();
  if (!cache || Date.now() - cache.at > TTL_MS) {
    const rows = await prisma.bulkPriceCategory.findMany({ orderBy: { sortOrder: "asc" } });
    cache = { at: Date.now(), rows: rows.map((r) => ({ ...r, group: r.group as BulkGroup, tier: r.tier as BulkTier })) };
  }
  return opts.includeDisabled ? cache.rows : cache.rows.filter((r) => r.enabled);
}

export function invalidateBulkPricingCache(): void {
  cache = null;
}

/** Naam in de taal van de bezoeker. */
export function bulkRowName(row: Pick<BulkPriceRow, "name" | "nameEn">, locale: string): string {
  return locale === "en" ? row.nameEn : row.name;
}
