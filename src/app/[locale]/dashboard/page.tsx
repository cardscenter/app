import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { DashboardStatsLocked } from "@/components/dashboard/dashboard-stats-locked";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const t = await getTranslations("dashboard");
  const tw = await getTranslations("wallet");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      displayName: true,
      balance: true,
      reservedBalance: true,
      heldBalance: true,
      accountType: true,
      _count: {
        select: {
          auctions: { where: { status: "ACTIVE" } },
          claimsales: { where: { status: "LIVE" } },
          listings: { where: { status: "ACTIVE" } },
          purchasedItems: true,
        },
      },
    },
  });

  if (!user) return null;

  const availableBalance = Math.max(0, user.balance - user.reservedBalance);
  const hasPremium = user.accountType !== "FREE";

  const stats = [
    { label: t("myAuctions"), value: user._count.auctions, href: "/dashboard/veilingen" },
    { label: t("myClaimsales"), value: user._count.claimsales, href: "/dashboard/claimsales" },
    { label: t("myListings"), value: user._count.listings, href: "/dashboard/marktplaats" },
    { label: t("myPurchases"), value: user._count.purchasedItems, href: "/dashboard/aankopen" },
    { label: tw("balance"), value: `€${availableBalance.toFixed(2)}`, href: "/dashboard/saldo" },
  ];

  // Fetch premium stats data if user has premium
  let premiumData = null;
  if (hasPremium) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Revenue data
    const [auctionSales, claimsaleItems, listingSales] = await Promise.all([
      prisma.auction.findMany({
        where: { sellerId: session.user.id, status: { in: ["ENDED_SOLD", "BOUGHT_NOW"] } },
        select: { finalPrice: true, updatedAt: true },
      }),
      prisma.claimsaleItem.findMany({
        where: { claimsale: { sellerId: session.user.id }, status: "SOLD" },
        select: { price: true, updatedAt: true },
      }),
      prisma.listing.findMany({
        where: { sellerId: session.user.id, status: "SOLD" },
        select: { price: true, updatedAt: true },
      }),
    ]);

    const totalRevenue =
      auctionSales.reduce((s, a) => s + (a.finalPrice ?? 0), 0) +
      claimsaleItems.reduce((s, i) => s + i.price, 0) +
      listingSales.reduce((s, l) => s + (l.price ?? 0), 0);

    const thisMonthRevenue =
      auctionSales.filter((a) => a.updatedAt >= startOfMonth).reduce((s, a) => s + (a.finalPrice ?? 0), 0) +
      claimsaleItems.filter((i) => i.updatedAt >= startOfMonth).reduce((s, i) => s + i.price, 0) +
      listingSales.filter((l) => l.updatedAt >= startOfMonth).reduce((s, l) => s + (l.price ?? 0), 0);

    // Recent activity
    const [newBids, newMessages, newReviews] = await Promise.all([
      prisma.auctionBid.count({
        where: {
          auction: { sellerId: session.user.id },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.message.count({
        where: {
          conversation: { participants: { some: { userId: session.user.id } } },
          senderId: { not: session.user.id },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.review.count({
        where: {
          sellerId: session.user.id,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    // Active items ending soon
    const auctionsEndingSoon = await prisma.auction.count({
      where: {
        sellerId: session.user.id,
        status: "ACTIVE",
        endTime: { lte: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      },
    });

    // Chart data: last 30 days revenue by day
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        type: "SALE",
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      select: { amount: true, createdAt: true },
    });

    const chartMap = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      chartMap.set(date.toISOString().split("T")[0], 0);
    }
    for (const tx of transactions) {
      const dateKey = tx.createdAt.toISOString().split("T")[0];
      if (chartMap.has(dateKey)) {
        chartMap.set(dateKey, (chartMap.get(dateKey) ?? 0) + tx.amount);
      }
    }

    premiumData = {
      revenue: {
        total: totalRevenue,
        thisMonth: thisMonthRevenue,
        inEscrow: user.heldBalance,
      },
      activeItems: {
        auctionsEndingSoon,
        activeClaimsales: user._count.claimsales,
        activeListings: user._count.listings,
      },
      recentActivity: {
        newBids,
        newMessages,
        newReviews,
      },
      chartData: Array.from(chartMap.entries()).map(([date, revenue]) => ({
        date: new Date(date).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }),
        revenue,
      })),
    };
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">
        {t("title")}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {user.displayName}
      </p>

      {/* Quick stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <Link
            key={stat.href}
            href={stat.href}
            className="glass rounded-2xl p-4 transition-all hover:scale-[1.02] hover:shadow-md"
          >
            <p className="text-xs text-muted-foreground">
              {stat.label}
            </p>
            <p className="mt-1 text-xl font-bold text-foreground">
              {stat.value}
            </p>
          </Link>
        ))}
      </div>

      {/* Premium stats or locked preview */}
      <div className="mt-8">
        {hasPremium && premiumData ? (
          <DashboardStats {...premiumData} />
        ) : (
          <DashboardStatsLocked />
        )}
      </div>
    </div>
  );
}
