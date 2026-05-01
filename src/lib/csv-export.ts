type DateValueRow = { date: Date | string; value: number };

function escapeCsv(value: string | number): string {
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowsToCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers.map(escapeCsv).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsv).join(","));
  }
  return lines.join("\r\n");
}

function formatDate(d: Date | string): string {
  return new Date(d).toISOString().split("T")[0];
}

export function buildSalesCsv(data: {
  auctions: DateValueRow[];
  claimsales: DateValueRow[];
  listings: DateValueRow[];
}): string {
  const rows: (string | number)[][] = [
    ...data.auctions.map((r) => [formatDate(r.date), "auction", r.value.toFixed(2)]),
    ...data.claimsales.map((r) => [formatDate(r.date), "claimsale", r.value.toFixed(2)]),
    ...data.listings.map((r) => [formatDate(r.date), "listing", r.value.toFixed(2)]),
  ].sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  return rowsToCsv(["date", "type", "amount_eur"], rows);
}

export function buildBuyerCsv(data: {
  auctions: DateValueRow[];
  claimsales: DateValueRow[];
  listings: DateValueRow[];
}): string {
  return buildSalesCsv(data);
}

export function buildPerformanceCsv(reviews: {
  rating: number;
  packagingRating: number | null;
  shippingRating: number | null;
  communicationRating: number | null;
  createdAt: Date;
}[]): string {
  const rows = reviews.map((r) => [
    formatDate(r.createdAt),
    r.rating,
    r.packagingRating ?? "",
    r.shippingRating ?? "",
    r.communicationRating ?? "",
  ]);

  return rowsToCsv(
    ["date", "rating", "packaging", "shipping", "communication"],
    rows
  );
}

export function buildCommissionSavingsCsv(data: {
  commissionSaved: number;
  projectedAnnualSavings: number;
}): string {
  return rowsToCsv(
    ["metric", "amount_eur"],
    [
      ["commission_saved", data.commissionSaved.toFixed(2)],
      ["projected_annual_savings", data.projectedAnnualSavings.toFixed(2)],
    ]
  );
}

export function buildXpCsv(xp: {
  accountAge: number;
  sales: number;
  purchases: number;
  positiveReviews: number;
  reviewsGiven: number;
  completedTransactions: number;
  bonus: number;
  total: number;
}): string {
  return rowsToCsv(
    ["category", "xp"],
    [
      ["account_age", xp.accountAge],
      ["sales", xp.sales],
      ["purchases", xp.purchases],
      ["positive_reviews", xp.positiveReviews],
      ["reviews_given", xp.reviewsGiven],
      ["completed_transactions", xp.completedTransactions],
      ["bonus", xp.bonus],
      ["total", xp.total],
    ]
  );
}
