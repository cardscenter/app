/**
 * Competitor comparison data for the (desktop-only) homepage section.
 *
 * Peildatum: keep `COMPETITOR_DATA_AS_OF_*` in sync with last verification.
 * Re-check rates every 6 months. All figures are from public pricing pages
 * of each platform.
 *
 * Cards Center figures are FREE-tier (default for new visitors): 2,9% buyer
 * premium + 3% seller commission. Range "0–3%" on seller-commission row
 * surfaces the value-prop that paid tiers go down to 0%.
 *
 * Fee values are stored as plain strings (locale-neutral within EU). Status
 * labels that require translation (e.g. "Geen veilingen", "Beperkt") go
 * through `labelKey` against the `home` namespace.
 */

export const COMPETITOR_DATA_AS_OF_NL = "mei 2026";
export const COMPETITOR_DATA_AS_OF_EN = "May 2026";

export type DimensionKey = "fees" | "trust" | "tcg" | "service";
export type CellStatus = "yes" | "no" | "partial" | "na";
export type CompetitorKey =
  | "cardscenter"
  | "catawiki"
  | "ebay"
  | "cardmarket"
  | "marktplaats";

export interface CompetitorCell {
  status: CellStatus;
  /** Plain text for the cell (used for fees). Locale-neutral. */
  value?: string;
  /** Translated label (used for status-text like "Beperkt"). */
  labelKey?: string;
}

export interface CompetitorRow {
  key: CompetitorKey;
  displayName: string;
  isUs: boolean;
  /** Same order as `DIMENSIONS[dim].rowKeys`. */
  cells: Record<DimensionKey, CompetitorCell[]>;
}

export const DIMENSIONS: Array<{
  key: DimensionKey;
  /** "value" = fees-style cells (show text, no icon).
   *  "feature" = ✓/✗/~/— icon cells with optional label. */
  displayMode: "value" | "feature";
  rowKeys: string[];
}> = [
  {
    key: "fees",
    displayMode: "value",
    rowKeys: [
      "buyerPremium",
      "buyerCommission",
      "paymentFee",
      "sellerCommission",
      "payoutFee",
    ],
  },
  {
    key: "trust",
    displayMode: "feature",
    rowKeys: [
      "escrow",
      "disputeSystem",
      "verification",
      "autoCancelProtection",
      "antiSnipe",
      "sellerLevels",
    ],
  },
  {
    key: "tcg",
    displayMode: "feature",
    rowKeys: ["pokemonOnly", "liveTcgData", "claimsales", "bundleOffers", "buyback"],
  },
  {
    key: "service",
    displayMode: "feature",
    rowKeys: ["nlSupport", "realtime", "mobileFlow", "statistics"],
  },
];

export const COMPETITORS: CompetitorRow[] = [
  {
    key: "cardscenter",
    displayName: "Cards Center",
    isUs: true,
    cells: {
      fees: [
        { status: "yes", value: "2,9%" },
        { status: "yes", value: "0%" },
        { status: "yes", labelKey: "competitorCellIdealFree" },
        { status: "yes", value: "0–3%" },
        { status: "yes", value: "€0" },
      ],
      trust: [
        { status: "yes" },
        { status: "yes" },
        { status: "yes", labelKey: "competitorCellTrust3Types" },
        { status: "yes" },
        { status: "yes" },
        { status: "yes", labelKey: "competitorCell14Tier" },
      ],
      tcg: [
        { status: "yes" },
        { status: "yes" },
        { status: "yes" },
        { status: "yes" },
        { status: "yes" },
      ],
      service: [
        { status: "yes" },
        { status: "yes" },
        { status: "yes" },
        { status: "yes" },
      ],
    },
  },
  {
    key: "catawiki",
    displayName: "Catawiki",
    isUs: false,
    cells: {
      fees: [
        { status: "no", value: "9%" },
        { status: "no", value: "9%" },
        { status: "yes", value: "€0" },
        { status: "no", value: "12,5%" },
        { status: "yes", value: "€0" },
      ],
      trust: [
        { status: "yes" },
        { status: "partial", labelKey: "competitorCellPartial" },
        { status: "no" },
        { status: "no" },
        { status: "yes" },
        { status: "partial", labelKey: "competitorCellPartial" },
      ],
      tcg: [
        { status: "no" },
        { status: "no" },
        { status: "no" },
        { status: "no" },
        { status: "no" },
      ],
      service: [
        { status: "yes" },
        { status: "no" },
        { status: "yes" },
        { status: "partial", labelKey: "competitorCellPartial" },
      ],
    },
  },
  {
    key: "ebay",
    displayName: "eBay",
    isUs: false,
    cells: {
      fees: [
        { status: "partial", labelKey: "competitorCellIncluded" },
        { status: "yes", value: "0%" },
        { status: "yes", value: "€0" },
        { status: "no", value: "15%" },
        { status: "partial", labelKey: "competitorCellPartial" },
      ],
      trust: [
        { status: "partial", labelKey: "competitorCellPartial" },
        { status: "partial", labelKey: "competitorCellPartial" },
        { status: "no" },
        { status: "no" },
        { status: "partial", labelKey: "competitorCellPartial" },
        { status: "partial", labelKey: "competitorCellFeedbackScore" },
      ],
      tcg: [
        { status: "no" },
        { status: "no" },
        { status: "no" },
        { status: "partial", labelKey: "competitorCellPartial" },
        { status: "no" },
      ],
      service: [
        { status: "partial", labelKey: "competitorCellLimitedNl" },
        { status: "no" },
        { status: "yes" },
        { status: "partial", labelKey: "competitorCellSellerHub" },
      ],
    },
  },
  {
    key: "cardmarket",
    displayName: "Cardmarket",
    isUs: false,
    cells: {
      fees: [
        { status: "na", labelKey: "competitorCellNoAuctions" },
        { status: "partial", value: "0,5–1%" },
        { status: "no", value: "€0,35 + 5%" },
        { status: "partial", value: "5%" },
        { status: "yes", value: "€0" },
      ],
      trust: [
        { status: "partial", labelKey: "competitorCellTrusteeExtra" },
        { status: "partial", labelKey: "competitorCellPartial" },
        { status: "no" },
        { status: "no" },
        { status: "na", labelKey: "competitorCellNoAuctions" },
        { status: "partial", labelKey: "competitorCellPowerseller" },
      ],
      tcg: [
        { status: "no" },
        { status: "yes" },
        { status: "no" },
        { status: "yes" },
        { status: "no" },
      ],
      service: [
        { status: "partial", labelKey: "competitorCellGermanEnglish" },
        { status: "partial", labelKey: "competitorCellPartial" },
        { status: "yes" },
        { status: "partial", labelKey: "competitorCellPartial" },
      ],
    },
  },
  {
    key: "marktplaats",
    displayName: "Marktplaats",
    isUs: false,
    cells: {
      fees: [
        { status: "na", labelKey: "competitorCellNoAuctions" },
        { status: "yes", value: "0%" },
        { status: "na" },
        { status: "yes", value: "€0" },
        { status: "na" },
      ],
      trust: [
        { status: "no" },
        { status: "no" },
        { status: "no" },
        { status: "no" },
        { status: "na", labelKey: "competitorCellNoAuctions" },
        { status: "no" },
      ],
      tcg: [
        { status: "no" },
        { status: "no" },
        { status: "no" },
        { status: "no" },
        { status: "no" },
      ],
      service: [
        { status: "yes" },
        { status: "no" },
        { status: "yes" },
        { status: "no" },
      ],
    },
  },
];
