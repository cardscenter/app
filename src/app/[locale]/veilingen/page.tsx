import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Clock, Plus } from "lucide-react";
import { AuctionCard } from "@/components/auction/auction-card";
import { SponsoredAuctionRow } from "@/components/auction/sponsored-row";
import { Pagination } from "@/components/ui/pagination";
import { AuctionCreatedToast } from "@/components/auction/auction-created-toast";
import { AuctionSortBar } from "@/components/auction/auction-sort-bar";
import { getBuyerCountry, getSellerCountryFilter } from "@/lib/shipping/filter";

const PAGE_SIZE = 40;

type SortOption = "newest" | "ending" | "highest" | "bids";

// Seeded shuffle — same seed produces same order (consistent per day)
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getOrderBy(sort: SortOption) {
  switch (sort) {
    case "ending":
      return { endTime: "asc" as const };
    case "highest":
      return { currentBid: "desc" as const };
    case "bids":
      return undefined; // handled in JS
    case "newest":
    default:
      return { createdAt: "desc" as const };
  }
}

export default async function AuctionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; sort?: string; seed?: string }>;
}) {
  const { locale } = await params;
  const { page: pageParam, sort: sortParam, seed: seedParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const sort = (["newest", "ending", "highest", "bids"].includes(sortParam ?? "")
    ? sortParam
    : "newest") as SortOption;
  // Random seed generated on first visit, preserved across sort/page changes
  const seed = parseInt(seedParam || "0", 10) || Math.floor(Math.random() * 2147483647);

  const t = await getTranslations("auction");
  const tc = await getTranslations("common");

  const now = new Date();

  // Filter by buyer's country
  const buyerCountry = await getBuyerCountry();
  const countryFilter = getSellerCountryFilter(buyerCountry);

  // Fetch all sponsored auctions and shuffle for fairness
  const sponsoredRaw = await prisma.auction.findMany({
    where: {
      status: "ACTIVE",
      ...countryFilter,
      upsells: {
        some: {
          type: "CATEGORY_HIGHLIGHT",
          expiresAt: { gt: now },
        },
      },
    },
    include: {
      seller: { select: { displayName: true } },
      _count: { select: { bids: true } },
    },
  });
  const sponsoredAuctions = seededShuffle(sponsoredRaw, seed);

  // Single sponsored row — max 4 items
  const sponsoredTop = sponsoredAuctions.slice(0, 4);

  // Count ALL active auctions (sponsored included in main grid now)
  const totalCount = await prisma.auction.count({
    where: { status: "ACTIVE", ...countryFilter },
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Fetch paginated auctions (including sponsored ones)
  const orderBy = getOrderBy(sort);
  let auctions = await prisma.auction.findMany({
    where: { status: "ACTIVE", ...countryFilter },
    ...(orderBy ? { orderBy } : { orderBy: { createdAt: "desc" } }),
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      seller: { select: { displayName: true } },
      _count: { select: { bids: true } },
    },
  });

  // Sort by most bids in JS (Prisma can't order by _count directly)
  if (sort === "bids") {
    auctions = auctions.sort((a, b) => (b._count.bids ?? 0) - (a._count.bids ?? 0));
  }

  // For "ending" sort: push expired auctions to the end
  if (sort === "ending") {
    auctions = auctions.sort((a, b) => {
      const aEnd = new Date(a.endTime).getTime();
      const bEnd = new Date(b.endTime).getTime();
      const nowMs = now.getTime();
      const aExpired = aEnd <= nowMs;
      const bExpired = bEnd <= nowMs;
      if (aExpired !== bExpired) return aExpired ? 1 : -1;
      return aEnd - bEnd;
    });
  }

  const hasAuctions = auctions.length > 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <AuctionCreatedToast />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {tc("auctions")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("activeCount", { count: totalCount })}
          </p>
        </div>
        <Link
          href="/veilingen/nieuw"
          className="inline-flex items-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-md transition-all hover:bg-primary-hover hover:shadow-lg"
        >
          <Plus className="size-4 mr-1" />
          {t("createTitle")}
        </Link>
      </div>

      {/* Sort bar */}
      <div className="mt-6">
        <AuctionSortBar currentSort={sort} seed={seed} />
      </div>

      {!hasAuctions ? (
        <div className="mt-16 flex flex-col items-center justify-center">
          <div className="rounded-full bg-secondary p-4">
            <Clock className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{tc("noResults")}</p>
          <Link
            href="/veilingen/nieuw"
            className="mt-4 text-sm font-medium text-primary hover:text-primary-hover transition-colors"
          >
            {t("createTitle")} &rarr;
          </Link>
        </div>
      ) : (
        <div className="mt-8">
          {/* Sponsored row */}
          <SponsoredAuctionRow
            auctions={sponsoredTop}
            title={t("sponsored")}
            tooltip={t("sponsoredTooltip")}
          />

          {/* Main grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {auctions.map((auction) => (
              <AuctionCard key={auction.id} auction={auction} />
            ))}
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            baseUrl="/veilingen"
            locale={locale}
            extraParams={{ seed: String(seed), ...(sort !== "newest" ? { sort } : {}) }}
          />
        </div>
      )}
    </div>
  );
}
