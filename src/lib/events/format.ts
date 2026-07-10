// Nederlandse euro-notatie voor evenement-tickets:
//   hele getallen → "€7,-"     (bv. 7  → €7,-)
//   met centen    → "€7,50"    (bv. 7.5 → €7,50)
//   nul           → "Gratis"
export function formatEuro(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "Gratis";
  if (Number.isInteger(amount)) return `€${amount},-`;
  return `€${amount.toFixed(2).replace(".", ",")}`;
}

// Prijslabel voor kaarten/quick-view. Wizard-events bewaren prijzen in de
// ticketTypes-JSON (entryPrice is daar altijd null); entryPrice dekt alleen
// legacy-rijen van vóór het TIERS-model.
export function getEventPriceLabel(event: {
  entryType: string;
  entryPrice: number | null;
  ticketTypes: string | null;
}): string {
  if (event.entryType === "FREE") return "Gratis entree";

  let prices: number[] = [];
  if (event.ticketTypes) {
    try {
      const parsed = JSON.parse(event.ticketTypes);
      if (Array.isArray(parsed)) {
        prices = parsed
          .map((t) => Number(t?.price))
          .filter((p) => Number.isFinite(p) && p >= 0);
      }
    } catch {
      // corrupte JSON → val terug op de branches hieronder
    }
  }

  if (prices.length > 0) {
    // Min. positieve prijs, zodat een "Kind €0"-tier geen "Vanaf Gratis" geeft.
    const positive = prices.filter((p) => p > 0);
    if (positive.length === 0) return "Gratis entree";
    const min = Math.min(...positive);
    return prices.length === 1 ? formatEuro(min) : `Vanaf ${formatEuro(min)}`;
  }

  if (event.entryPrice != null && event.entryPrice > 0) return formatEuro(event.entryPrice);
  return "Betaald";
}
