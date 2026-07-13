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

export function groupByDay(items: DateValue[]): GroupedData[] {
  const map = new Map<string, number>();

  for (const item of items) {
    const d = new Date(item.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

/** Bucket-granulariteit per periode (Fase 44): korte periodes per dag,
 *  vanaf 90 dagen per week, "alles" per maand. */
export type TimeBucket = "day" | "week" | "month";

export function bucketForPeriod(period: string): TimeBucket {
  if (["today", "yesterday", "7d", "30d", "month"].includes(period)) return "day";
  if (["90d", "ytd", "1y", "prevyear"].includes(period)) return "week";
  return "month"; // "all"
}

/** Bucket-key + as-label voor één datum. */
export function bucketKey(date: Date | string, bucket: TimeBucket): { key: string; label: string } {
  const d = new Date(date);
  if (bucket === "day") {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { key, label: d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" }) };
  }
  if (bucket === "week") {
    const startOfWeek = new Date(d);
    startOfWeek.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // maandag
    const key = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, "0")}-${String(startOfWeek.getDate()).padStart(2, "0")}`;
    return { key, label: startOfWeek.toLocaleDateString("nl-NL", { day: "numeric", month: "short" }) };
  }
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return { key, label: d.toLocaleDateString("nl-NL", { month: "short", year: "2-digit" }) };
}

export type PeriodRange = {
  start: Date;
  end: Date;
  previousStart: Date;
  /** In alle periodes geldt previousEnd === start — expliciet veld voor leesbaarheid. */
  previousEnd: Date;
};

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Start/eind van de gekozen periode + de even-lange vergelijkingsperiode
 * ervóór. Periodes met een einde in het verleden (gisteren, vorig jaar)
 * hebben `end < now` — data moet dus óók op end gefilterd worden.
 */
export function getPeriodRange(period: string): PeriodRange {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (period) {
    case "today": {
      const start = startOfToday;
      return { start, end: now, previousStart: addDays(start, -1), previousEnd: start };
    }
    case "yesterday": {
      const start = addDays(startOfToday, -1);
      return { start, end: startOfToday, previousStart: addDays(start, -1), previousEnd: start };
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        start,
        end: now,
        previousStart: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        previousEnd: start,
      };
    }
    case "ytd": {
      const start = new Date(now.getFullYear(), 0, 1);
      return {
        start,
        end: now,
        previousStart: new Date(now.getFullYear() - 1, 0, 1),
        previousEnd: start,
      };
    }
    case "prevyear": {
      const start = new Date(now.getFullYear() - 1, 0, 1);
      const end = new Date(now.getFullYear(), 0, 1);
      return { start, end, previousStart: new Date(now.getFullYear() - 2, 0, 1), previousEnd: start };
    }
    default: {
      const days =
        period === "7d" ? 7
        : period === "30d" ? 30
        : period === "90d" ? 90
        : period === "1y" ? 365
        : period === "all" ? 365 * 10
        : 90;
      const start = addDays(now, -days);
      return { start, end: now, previousStart: addDays(start, -days), previousEnd: start };
    }
  }
}

export function getPeriodDates(period: string): { start: Date; previousStart: Date } {
  const { start, previousStart } = getPeriodRange(period);
  return { start, previousStart };
}

/**
 * Returns the number of days the current period covers, used for extrapolating
 * annualized projections (e.g. projected commission savings).
 */
export function getPeriodDayCount(period: string): number {
  const { start, end } = getPeriodRange(period);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
}
