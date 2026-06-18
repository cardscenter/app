// Nederlandse euro-notatie voor evenement-tickets:
//   hele getallen → "€7,-"     (bv. 7  → €7,-)
//   met centen    → "€7,50"    (bv. 7.5 → €7,50)
//   nul           → "Gratis"
export function formatEuro(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "Gratis";
  if (Number.isInteger(amount)) return `€${amount},-`;
  return `€${amount.toFixed(2).replace(".", ",")}`;
}
