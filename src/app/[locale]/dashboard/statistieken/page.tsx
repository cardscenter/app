import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { StatisticsPage } from "@/components/dashboard/statistics/statistics-page";
import { StatisticsLocked } from "@/components/dashboard/statistics/statistics-locked";
import {
  fetchSalesData,
  fetchBuyerData,
  fetchSellerPerformance,
} from "@/lib/statistics-queries";
import {
  buildRatingDistribution,
  computeAverage,
  getPeriodRange,
  getPeriodDayCount,
  bucketForPeriod,
  bucketKey,
} from "@/lib/statistics-helpers";
import { getCommissionRate } from "@/lib/subscription-tiers";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ period?: string }>;
};

export default async function StatistiekenPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);
  const t = await getTranslations("dashboard");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true },
  });

  if (!user) return null;

  const hasPremium = user.accountType !== "FREE";

  if (!hasPremium) {
    return (
      <div className="space-y-6">
        <DashboardPageHeader title={t("statistics.title")} />
        <StatisticsLocked />
      </div>
    );
  }

  const resolvedSearchParams = await searchParams;
  const period = resolvedSearchParams.period ?? "90d";
  const { start, end, previousStart } = getPeriodRange(period);
  const bucket = bucketForPeriod(period);

  // Fetch all data in parallel. Periodes met een einde in het verleden
  // (gisteren, vorig jaar) worden ook op `end` gefilterd; de vergelijkings-
  // periode is altijd het even-lange venster vóór `start`.
  const [
    salesData,
    prevSalesData,
    buyerData,
    prevBuyerData,
    perfData,
    prevPerfData,
  ] = await Promise.all([
    fetchSalesData(session.user.id, start).then((d) => filterBefore(d, end)),
    fetchSalesData(session.user.id, previousStart).then((d) => filterBefore(d, start)),
    fetchBuyerData(session.user.id, start).then((d) => filterBefore(d, end)),
    fetchBuyerData(session.user.id, previousStart).then((d) => filterBefore(d, start)),
    fetchSellerPerformance(session.user.id, start).then((d) => ({
      bundles: d.bundles.filter((b) => b.createdAt < end),
      reviews: d.reviews.filter((r) => r.createdAt < end),
    })),
    fetchSellerPerformance(session.user.id, previousStart).then((d) => ({
      bundles: d.bundles.filter((b) => b.createdAt < start),
      reviews: d.reviews.filter((r) => r.createdAt < start),
    })),
  ]);

  // === SALES ===
  const allSales = [...salesData.auctions, ...salesData.claimsales, ...salesData.listings];
  const prevAllSales = [...prevSalesData.auctions, ...prevSalesData.claimsales, ...prevSalesData.listings];
  const totalRevenue = allSales.reduce((s, i) => s + i.value, 0);
  const prevTotalRevenue = prevAllSales.reduce((s, i) => s + i.value, 0);
  const itemsSold = allSales.length;
  const prevItemsSold = prevAllSales.length;
  const avgSalePrice = itemsSold > 0 ? totalRevenue / itemsSold : 0;
  const prevAvgSalePrice = prevItemsSold > 0 ? prevTotalRevenue / prevItemsSold : 0;

  const revenueByType = [
    { name: t("statistics.auctions"), value: salesData.auctions.reduce((s, i) => s + i.value, 0) },
    { name: t("statistics.claimsales"), value: salesData.claimsales.reduce((s, i) => s + i.value, 0) },
    { name: t("statistics.listings"), value: salesData.listings.reduce((s, i) => s + i.value, 0) },
  ];

  // Omzetverloop + gemiddelde prijs per bucket (dag ≤30d, week 90d/ytd/1j,
  // maand bij "alles") — de bucket-key sorteert chronologisch (Fase 44).
  const revenueBuckets = new Map<string, { label: string; values: number[] }>();
  for (const item of allSales) {
    const { key, label } = bucketKey(item.date, bucket);
    if (!revenueBuckets.has(key)) revenueBuckets.set(key, { label, values: [] });
    revenueBuckets.get(key)!.values.push(item.value);
  }
  const sortedRevenueBuckets = Array.from(revenueBuckets.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const revenueOverTime = sortedRevenueBuckets.map(([, g]) => ({
    label: g.label,
    revenue: Math.round(g.values.reduce((s, v) => s + v, 0) * 100) / 100,
  }));
  const avgPriceOverTime = sortedRevenueBuckets.map(([, g]) => ({
    label: g.label,
    avgPrice: computeAverage(g.values),
  }));

  // === BUYER ===
  const allPurchases = [...buyerData.auctions, ...buyerData.claimsales, ...buyerData.listings];
  const prevAllPurchases = [...prevBuyerData.auctions, ...prevBuyerData.claimsales, ...prevBuyerData.listings];
  const totalSpent = allPurchases.reduce((s, i) => s + i.value, 0);
  const prevTotalSpent = prevAllPurchases.reduce((s, i) => s + i.value, 0);

  const spendingByType = [
    { name: t("statistics.auctions"), value: buyerData.auctions.reduce((s, i) => s + i.value, 0) },
    { name: t("statistics.claimsales"), value: buyerData.claimsales.reduce((s, i) => s + i.value, 0) },
    { name: t("statistics.listings"), value: buyerData.listings.reduce((s, i) => s + i.value, 0) },
  ];

  const purchaseBuckets = new Map<string, { label: string; count: number }>();
  for (const item of allPurchases) {
    const { key, label } = bucketKey(item.date, bucket);
    const existing = purchaseBuckets.get(key);
    if (existing) existing.count += 1;
    else purchaseBuckets.set(key, { label, count: 1 });
  }
  const purchaseFrequency = Array.from(purchaseBuckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, g]) => ({ label: g.label, count: g.count }));

  // === SELLER PERFORMANCE ===
  function avgDays(bundles: { createdAt: Date; shippedAt: Date | null; deliveredAt: Date | null }[], field: "shippedAt" | "deliveredAt") {
    const valid = bundles.filter((b) => b[field] != null);
    if (valid.length === 0) return 0;
    const fromField = field === "shippedAt" ? "createdAt" : "shippedAt";
    const diffs = valid.map((b) => {
      const from = b[fromField] as Date;
      const to = b[field] as Date;
      return (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
    });
    return computeAverage(diffs);
  }

  const avgShipDays = avgDays(perfData.bundles, "shippedAt");
  const prevAvgShipDays = avgDays(prevPerfData.bundles, "shippedAt");
  const avgDeliveryDays = avgDays(perfData.bundles, "deliveredAt");
  const prevAvgDeliveryDays = avgDays(prevPerfData.bundles, "deliveredAt");

  const overallRating = computeAverage(perfData.reviews.map((r) => r.rating));
  const prevOverallRating = computeAverage(prevPerfData.reviews.map((r) => r.rating));

  // Ratings over time
  const ratingsByMonth = new Map<string, number[]>();
  for (const r of perfData.reviews) {
    const d = new Date(r.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!ratingsByMonth.has(key)) ratingsByMonth.set(key, []);
    ratingsByMonth.get(key)!.push(r.rating);
  }
  const ratingsOverTime = Array.from(ratingsByMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, ratings]) => {
      const [year, month] = key.split("-");
      const d = new Date(Number(year), Number(month) - 1);
      return {
        month: d.toLocaleDateString("nl-NL", { month: "short", year: "2-digit" }),
        avgRating: computeAverage(ratings),
      };
    });

  const ratingDistribution = buildRatingDistribution(perfData.reviews);

  const subRatings = {
    packaging: computeAverage(perfData.reviews.filter((r) => r.packagingRating != null).map((r) => r.packagingRating!)),
    shipping: computeAverage(perfData.reviews.filter((r) => r.shippingRating != null).map((r) => r.shippingRating!)),
    communication: computeAverage(perfData.reviews.filter((r) => r.communicationRating != null).map((r) => r.communicationRating!)),
  };

  // XP/level-sectie is per Fase 44 van deze pagina af — dat leeft op
  // /dashboard/level (Reputatie-cluster).

  // === COMMISSION SAVINGS (PRO/UNLIMITED voordeel t.o.v. FREE) ===
  const freeRate = 0.03;
  const currentRate = getCommissionRate(user.accountType);
  const hypotheticalFreeCommission = totalRevenue * freeRate;
  const actualCommission = totalRevenue * currentRate;
  const commissionSaved = Math.max(0, hypotheticalFreeCommission - actualCommission);

  // Projected annual savings: extrapolate from current period
  const periodDays = getPeriodDayCount(period);
  const projectedAnnualSavings = (commissionSaved / periodDays) * 365;

  return (
    <div className="space-y-6">
      <DashboardPageHeader title={t("statistics.title")} subtitle={t("statistics.subtitle")} />

      <StatisticsPage
        period={period}
        sales={{
          totalRevenue,
          previousTotalRevenue: prevTotalRevenue,
          itemsSold,
          previousItemsSold: prevItemsSold,
          avgSalePrice,
          previousAvgSalePrice: prevAvgSalePrice,
          revenueByType,
          revenueOverTime,
          avgPriceOverTime,
        }}
        performance={{
          avgShipDays,
          previousAvgShipDays: prevAvgShipDays,
          avgDeliveryDays,
          previousAvgDeliveryDays: prevAvgDeliveryDays,
          overallRating,
          previousOverallRating: prevOverallRating,
          ratingsOverTime,
          ratingDistribution,
          subRatings,
        }}
        buyer={{
          totalSpent,
          previousTotalSpent: prevTotalSpent,
          itemsPurchased: allPurchases.length,
          previousItemsPurchased: prevAllPurchases.length,
          spendingByType,
          purchaseFrequency,
        }}
        commission={{
          commissionSaved,
          projectedAnnualSavings,
        }}
      />
    </div>
  );
}

// Helper: filter data items to before a cutoff date
function filterBefore(
  data: { auctions: { date: Date; value: number }[]; claimsales: { date: Date; value: number }[]; listings: { date: Date; value: number }[] },
  cutoff: Date
) {
  return {
    auctions: data.auctions.filter((i) => i.date < cutoff),
    claimsales: data.claimsales.filter((i) => i.date < cutoff),
    listings: data.listings.filter((i) => i.date < cutoff),
  };
}
