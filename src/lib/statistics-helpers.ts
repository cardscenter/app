export type DateValue = { date: Date | string; value: number };
export type GroupedData = { key: string; label: string; total: number };

export function groupByMonth(items: DateValue[]): GroupedData[] {
  const map = new Map<string, number>();

  for (const item of items) {
    const d = new Date(item.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    map.set(key, (map.get(key) ?? 0) + item.value);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, total]) => {
      const [year, month] = key.split("-");
      const d = new Date(Number(year), Number(month) - 1);
      return {
        key,
        label: d.toLocaleDateString("nl-NL", { month: "short", year: "2-digit" }),
        total: Math.round(total * 100) / 100,
      };
    });
}

export function groupByWeek(items: DateValue[]): GroupedData[] {
  const map = new Map<string, number>();

  for (const item of items) {
    const d = new Date(item.date);
    const startOfWeek = new Date(d);
    startOfWeek.setDate(d.getDate() - d.getDay() + 1); // Monday
    const key = startOfWeek.toISOString().split("T")[0];
    map.set(key, (map.get(key) ?? 0) + item.value);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, total]) => ({
      key,
      label: new Date(key).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }),
      total: Math.round(total * 100) / 100,
    }));
}

export function calculatePeriodComparison(
  current: number,
  previous: number
): { change: number; direction: "up" | "down" | "flat" } {
  if (previous === 0 && current === 0) return { change: 0, direction: "flat" };
  if (previous === 0) return { change: 100, direction: "up" };

  const change = Math.round(((current - previous) / previous) * 100);
  return {
    change: Math.abs(change),
    direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
  };
}

export function buildRatingDistribution(
  reviews: { rating: number }[]
): { rating: number; count: number }[] {
  const dist = [1, 2, 3, 4, 5].map((r) => ({
    rating: r,
    count: reviews.filter((rev) => Math.round(rev.rating) === r).length,
  }));
  return dist;
}

export function computeAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100;
}

export function getPeriodDates(period: string): { start: Date; previousStart: Date } {
  const now = new Date();
  let daysBack: number;

  switch (period) {
    case "30d":
      daysBack = 30;
      break;
    case "90d":
      daysBack = 90;
      break;
    case "1y":
      daysBack = 365;
      break;
    case "all":
      daysBack = 365 * 10; // 10 years as "all"
      break;
    default:
      daysBack = 90;
  }

  const start = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const previousStart = new Date(start.getTime() - daysBack * 24 * 60 * 60 * 1000);

  return { start, previousStart };
}
