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
  fetchCommissionData,
  fetchXPData,
} from "@/lib/statistics-queries";
import {
  groupByMonth,
  calculatePeriodComparison,
  buildRatingDistribution,
  computeAverage,
  getPeriodDates,
} from "@/lib/statistics-helpers";
import {
  calculateXP,
  getLevel,
  getNextLevel,
  getLevelProgress,
} from "@/lib/seller-levels";
import { getCommissionRate } from "@/lib/subscription-tiers";

type Props = {
  searchParams: Promise<{ period?: string }>;
};

export default async function StatistiekenPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const t = await getTranslations("dashboard");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true },
  });

  if (!user) return null;

  const hasPremium = user.accountType !== "FREE";

  if (!hasPremium) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("statistics.title")}</h1>
        <div className="mt-6">
          <StatisticsLocked />
        </div>
      </div>
    );
  }

  const params = await searchParams;
  const period = params.period ?? "90d";
  const { start, previousStart } = getPeriodDates(period);

  // Fetch all data in parallel
  const [
    salesData,
    prevSalesData,
    buyerData,
    prevBuyerData,
    perfData,
    prevPerfData,
    commissionTx,
    prevCommissionTx,
    xpRaw,
  ] = await Promise.all([
    fetchSalesData(session.user.id, start),
    fetchSalesData(session.user.id, previousStart).then((d) => filterBefore(d, start)),
    fetchBuyerData(session.user.id, start),
    fetchBuyerData(session.user.id, previousStart).then((d) => filterBefore(d, start)),
    fetchSellerPerformance(session.user.id, start),
    fetchSellerPerformance(session.user.id, previousStart).then((d) => ({
      bundles: d.bundles.filter((b) => b.createdAt < start),
      reviews: d.reviews.filter((r) => r.createdAt < start),
    })),
    fetchCommissionData(session.user.id, start),
    fetchCommissionData(session.user.id, previousStart).then((txs) =>
      txs.filter((tx) => tx.createdAt < start)
    ),
    fetchXPData(session.user.id),
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

  const revenuePerMonth = groupByMonth(allSales).map((g) => ({ month: g.label, revenue: g.total }));

  // Avg price per month
  const monthGroups = new Map<string, number[]>();
  for (const item of allSales) {
    const d = new Date(item.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthGroups.has(key)) monthGroups.set(key, []);
    monthGroups.get(key)!.push(item.value);
  }
  const avgPricePerMonth = Array.from(monthGroups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => {
      const [year, month] = key.split("-");
      const d = new Date(Number(year), Number(month) - 1);
      return {
        month: d.toLocaleDateString("nl-NL", { month: "short", year: "2-digit" }),
        avgPrice: computeAverage(values),
      };
    });

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

  const purchaseCountPerMonth = new Map<string, number>();
  for (const item of allPurchases) {
    const d = new Date(item.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    purchaseCountPerMonth.set(key, (purchaseCountPerMonth.get(key) ?? 0) + 1);
  }
  const purchaseFrequency = Array.from(purchaseCountPerMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => {
      const [year, month] = key.split("-");
      const d = new Date(Number(year), Number(month) - 1);
      return { month: d.toLocaleDateString("nl-NL", { month: "short", year: "2-digit" }), count };
    });

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

  // === XP ===
  let xpData;
  if (xpRaw) {
    const xpBreakdown = calculateXP(xpRaw);
    const currentLevel = getLevel(xpBreakdown.total);
    const nextLevel = getNextLevel(xpBreakdown.total);
    xpData = {
      xp: xpBreakdown,
      currentLevel: {
        name: currentLevel.name,
        icon: currentLevel.icon,
        color: currentLevel.color,
        minXP: currentLevel.minXP,
      },
      nextLevel: nextLevel ? { name: nextLevel.name, minXP: nextLevel.minXP } : null,
      progress: getLevelProgress(xpBreakdown.total),
    };
  } else {
    xpData = {
      xp: { accountAge: 0, sales: 0, purchases: 0, positiveReviews: 0, reviewsGiven: 0, completedTransactions: 0, bonus: 0, total: 0 },
      currentLevel: { name: "Beginner", icon: "🎒", color: "text-gray-500", minXP: 0 },
      nextLevel: { name: "Rookie", minXP: 100 },
      progress: 0,
    };
  }

  // === COMMISSION ===
  const totalCommissionPaid = commissionTx.reduce((s, tx) => s + Math.abs(tx.amount), 0);
  const prevCommissionPaid = prevCommissionTx.reduce((s, tx) => s + Math.abs(tx.amount), 0);

  // Commission saved: what it would have been at FREE rate (3%) vs actual
  const freeRate = 0.03;
  const currentRate = getCommissionRate(user.accountType);
  const hypotheticalFreeCommission = totalRevenue * freeRate;
  const actualCommission = totalRevenue * currentRate;
  const commissionSaved = Math.max(0, hypotheticalFreeCommission - actualCommission);

  // Projected annual savings: extrapolate from current period
  const periodDays = period === "30d" ? 30 : period === "90d" ? 90 : period === "1y" ? 365 : 365;
  const projectedAnnualSavings = periodDays > 0 ? (commissionSaved / periodDays) * 365 : 0;

  // Commission over time
  const commissionByMonth = new Map<string, number>();
  for (const tx of commissionTx) {
    const d = new Date(tx.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    commissionByMonth.set(key, (commissionByMonth.get(key) ?? 0) + Math.abs(tx.amount));
  }
  const commissionOverTime = Array.from(commissionByMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, total]) => {
      const [year, month] = key.split("-");
      const d = new Date(Number(year), Number(month) - 1);
      return { month: d.toLocaleDateString("nl-NL", { month: "short", year: "2-digit" }), total };
    });

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">{t("statistics.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground mb-6">{t("statistics.subtitle")}</p>

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
          revenuePerMonth,
          avgPricePerMonth,
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
        xp={xpData}
        commission={{
          totalCommissionPaid,
          previousCommissionPaid: prevCommissionPaid,
          commissionSaved,
          projectedAnnualSavings,
          commissionOverTime,
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
