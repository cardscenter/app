import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { ModerationTable } from "@/components/admin/moderation-table";

const TABS = [
  { key: "listings", label: "Listings" },
  { key: "auctions", label: "Auctions" },
  { key: "claimsales", label: "Claimsales" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const PAGE_SIZE = 100;

export default async function AdminModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; flagged?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const tab: TabKey = (TABS.find((t) => t.key === sp.tab)?.key ?? "listings") as TabKey;
  const flaggedOnly = sp.flagged === "1";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));

  // Find all reported user-ids for the "flagged" filter
  const reportedUserIds = flaggedOnly
    ? (await prisma.userReport.findMany({
        where: { status: { in: ["OPEN", "REVIEWING"] } },
        select: { reportedId: true },
        distinct: ["reportedId"],
      })).map((r) => r.reportedId)
    : null;

  // Helper: count open reports per seller (for the badge)
  async function reportCountFor(sellerIds: string[]) {
    if (sellerIds.length === 0) return new Map<string, number>();
    const counts = await prisma.userReport.groupBy({
      by: ["reportedId"],
      where: {
        reportedId: { in: sellerIds },
        status: { in: ["OPEN", "REVIEWING"] },
      },
      _count: { _all: true },
    });
    return new Map(counts.map((c) => [c.reportedId, c._count._all]));
  }

  let items: { id: string; title: string; status: string; sellerName: string; sellerId: string; sellerOpenReports: number; createdAt: string; amount: number | null }[] = [];

  if (tab === "listings") {
    const where: Record<string, unknown> = { status: "ACTIVE" };
    if (reportedUserIds) where.sellerId = { in: reportedUserIds };

    const rows = await prisma.listing.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, title: true, status: true, price: true, createdAt: true, sellerId: true, seller: { select: { displayName: true } } },
    });
    const reportCounts = await reportCountFor(rows.map((r) => r.sellerId));
    items = rows.map((r) => ({
      id: r.id, title: r.title, status: r.status, sellerName: r.seller.displayName,
      sellerId: r.sellerId, sellerOpenReports: reportCounts.get(r.sellerId) ?? 0,
      createdAt: r.createdAt.toISOString(), amount: r.price,
    }));
  } else if (tab === "auctions") {
    const where: Record<string, unknown> = { status: "ACTIVE" };
    if (reportedUserIds) where.sellerId = { in: reportedUserIds };

    const rows = await prisma.auction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, title: true, status: true, currentBid: true, startingBid: true, createdAt: true, sellerId: true, seller: { select: { displayName: true } } },
    });
    const reportCounts = await reportCountFor(rows.map((r) => r.sellerId));
    items = rows.map((r) => ({
      id: r.id, title: r.title, status: r.status, sellerName: r.seller.displayName,
      sellerId: r.sellerId, sellerOpenReports: reportCounts.get(r.sellerId) ?? 0,
      createdAt: r.createdAt.toISOString(), amount: r.currentBid ?? r.startingBid,
    }));
  } else {
    const where: Record<string, unknown> = { status: "LIVE" };
    if (reportedUserIds) where.sellerId = { in: reportedUserIds };

    const rows = await prisma.claimsale.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, title: true, status: true, createdAt: true, sellerId: true, seller: { select: { displayName: true } } },
    });
    const reportCounts = await reportCountFor(rows.map((r) => r.sellerId));
    items = rows.map((r) => ({
      id: r.id, title: r.title, status: r.status, sellerName: r.seller.displayName,
      sellerId: r.sellerId, sellerOpenReports: reportCounts.get(r.sellerId) ?? 0,
      createdAt: r.createdAt.toISOString(), amount: null,
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Content moderatie</h1>
        <p className="text-sm text-muted-foreground">
          Actieve listings, veilingen en claimsales. Filter op &quot;alleen verkopers met open rapporten&quot; en verwijder bulk met reden.
        </p>
      </div>

      <nav className="flex gap-1 rounded-xl border border-border bg-card p-1 shadow-card">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={{ pathname: "/dashboard/admin/moderation", query: { tab: t.key } }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                active ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex gap-2">
        <Link
          href={{ pathname: "/dashboard/admin/moderation", query: { tab } }}
          className={`rounded-md border px-3 py-1.5 text-sm ${flaggedOnly ? "" : "border-primary bg-primary text-white"}`}
        >
          Alle
        </Link>
        <Link
          href={{ pathname: "/dashboard/admin/moderation", query: { tab, flagged: "1" } }}
          className={`rounded-md border px-3 py-1.5 text-sm ${flaggedOnly ? "border-primary bg-primary text-white" : ""}`}
        >
          Alleen met open rapport
        </Link>
      </div>

      <ModerationTable kind={tab} items={items} />
    </div>
  );
}
