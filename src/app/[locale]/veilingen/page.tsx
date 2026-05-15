import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Plus } from "lucide-react";
import { AuctionCard } from "@/components/auction/auction-card";
import { AuctionListRow } from "@/components/auction/auction-list-row";
import { SponsoredAuctionRow } from "@/components/auction/sponsored-row";
import { Pagination } from "@/components/ui/pagination";
import { AuctionCreatedToast } from "@/components/auction/auction-created-toast";
import { AuctionSortBar } from "@/components/auction/auction-sort-bar";
import { AuctionViewToggle } from "@/components/auction/auction-view-toggle";
import { VeilingenFilterSidebar } from "@/components/auction/veilingen-filter-sidebar";
import { VeilingenMobileFilters } from "@/components/auction/veilingen-mobile-filters";
import { getBuyerLocation, getSellerCountryFilter } from "@/lib/shipping/filter";
import { auth } from "@/lib/auth";
import { getBlockedUserIds, sellerNotInBlockedFilter } from "@/lib/blocking";
import { PageContainer } from "@/components/layout/page-container";
import { parseAuctionFilters, buildAuctionFilterWhere } from "@/lib/auction-filters";
import { distanceKm } from "@/lib/distance";

const PAGE_SIZE = 40;

type SortOption = "newest" | "ending" | "highest" | "bids";

// Seeded shuffle — same seed produces same order (consistent per day).
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
  // Tier-based search-boost: tier-key is altijd SECONDARY.
  const tierBoost = { seller: { tierRank: "desc" as const } };
  // Status-asc als PRIMARY: 'ACTIVE' sorteert alfabetisch vóór 'SCHEDULED',
  // dus lopende veilingen komen altijd boven geplande in elke sort-modus.
  const statusFirst = { status: "asc" as const };
  switch (sort) {
    case "ending":
      return [statusFirst, { endTime: "asc" as const }, tierBoost];
    case "highest":
      // currentBid blijft null tot het eerste echte bod; nulls: 'last' zorgt
      // dat veilingen zonder bod (incl. SCHEDULED) onderaan komen — een
      // startbod telt niet als bod voor deze sort.
      return [
        statusFirst,
        { currentBid: { sort: "desc" as const, nulls: "last" as const } },
        tierBoost,
      ];
    case "bids":
      return undefined; // handled in JS — daar passen we de status-prioriteit ook toe
    case "newest":
    default:
      return [statusFirst, { createdAt: "desc" as const }, tierBoost];
  }
}

export default async function AuctionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;

  const pageRaw = typeof sp.page === "string" ? sp.page : undefined;
  const sortRaw = typeof sp.sort === "string" ? sp.sort : undefined;
  const seedRaw = typeof sp.seed === "string" ? sp.seed : undefined;

  const currentPage = Math.max(1, parseInt(pageRaw ?? "1", 10) || 1);
  const sort = (["newest", "ending", "highest", "bids"].includes(sortRaw ?? "")
    ? sortRaw
    : "newest") as SortOption;
  const seed =
    parseInt(seedRaw ?? "0", 10) || Math.floor(Math.random() * 2147483647);

  const t = await getTranslations("auction");
  const tc = await getTranslations("common");

  const now = new Date();

  // Buyer-location → distance + country-filter.
  const buyerLocation = await getBuyerLocation();
  const buyerCountry = buyerLocation?.country ?? null;
  const countryFilter = getSellerCountryFilter(buyerCountry);

  // Hide auctions from blocked sellers (both directions).
  const session = await auth();
  const blockedIds = await getBlockedUserIds(session?.user?.id);
  const sellerFilter = sellerNotInBlockedFilter(blockedIds);
  const blockingFilter = sellerFilter ? { sellerId: sellerFilter } : {};

  // Filter-state uit URL parsen + Prisma-where bouwen.
  const filters = parseAuctionFilters(sp);
  const filterWhere = buildAuctionFilterWhere(filters);

  // Sponsored-auctions (CATEGORY_HIGHLIGHT actief) — niet gefilterd.
  const sponsoredRaw = await prisma.auction.findMany({
    where: {
      status: "ACTIVE",
      ...countryFilter,
      ...blockingFilter,
      upsells: {
        some: { type: "CATEGORY_HIGHLIGHT", expiresAt: { gt: now } },
      },
    },
    include: {
      seller: { select: { displayName: true, city: true, postalCode: true, country: true } },
      _count: { select: { bids: true } },
      labels: { select: { type: true, colorKey: true } },
    },
  });
  const sponsoredAuctions = seededShuffle(sponsoredRaw, seed);
  const sponsoredTop = sponsoredAuctions.slice(0, 6);
  const sponsoredIds = sponsoredAuctions.map((a) => a.id);

  // Combineer filters voor de hoofdlijst. ACTIVE + SCHEDULED — geplande
  // veilingen tonen we ook in de resultaten, maar altijd achteraan via
  // status-asc orderBy (zie getOrderBy).
  const baseWhere = {
    status: { in: ["ACTIVE", "SCHEDULED"] as string[] },
    ...countryFilter,
    ...blockingFilter,
    ...filterWhere,
    ...(sponsoredIds.length > 0 ? { id: { notIn: sponsoredIds } } : {}),
  };

  // Radius-filter: SQLite kan geen haversine, dus post-filter in JS.
  const useRadiusPostFilter =
    filters.radius !== null && buyerLocation?.postalCode && buyerCountry;

  const orderBy = getOrderBy(sort);

  const AUCTION_INCLUDE = {
    seller: { select: { displayName: true, city: true, postalCode: true, country: true } },
    _count: { select: { bids: true } },
    labels: { select: { type: true, colorKey: true } },
  } satisfies Prisma.AuctionInclude;
  type AuctionPayload = Prisma.AuctionGetPayload<{ include: typeof AUCTION_INCLUDE }>;

  let totalCount: number;
  let auctions: AuctionPayload[];

  if (useRadiusPostFilter) {
    const candidates = await prisma.auction.findMany({
      where: baseWhere,
      orderBy: orderBy ?? { createdAt: "desc" as const },
      take: 500,
      include: AUCTION_INCLUDE,
    });
    const filtered = candidates.filter((a) => {
      const km = distanceKm({
        buyerCountry,
        buyerPostalCode: buyerLocation!.postalCode,
        sellerCountry: a.seller.country,
        sellerPostalCode: a.seller.postalCode,
      });
      if (km === null) return false;
      return km <= filters.radius!;
    });
    totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const safePage = Math.min(currentPage, totalPages);
    auctions = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  } else {
    totalCount = await prisma.auction.count({ where: baseWhere });
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const safePage = Math.min(currentPage, totalPages);
    auctions = await prisma.auction.findMany({
      where: baseWhere,
      orderBy: orderBy ?? { createdAt: "desc" as const },
      skip: (safePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: AUCTION_INCLUDE,
    });
  }

  // Sort by most bids in JS (Prisma kan niet by _count ordeneren).
  // Primary: status (ACTIVE < SCHEDULED) zodat geplande veilingen achteraan
  // komen. Secondary: bid-count desc.
  if (sort === "bids") {
    auctions = auctions.sort((a, b) => {
      if (a.status !== b.status) return a.status.localeCompare(b.status);
      return (b._count?.bids ?? 0) - (a._count?.bids ?? 0);
    });
  }
  if (sort === "ending") {
    // DB-sort heeft status-asc als primary al gedaan. Hier alleen binnen
    // ACTIVE: verlopen pushen we naar achter (zonder SCHEDULED door elkaar
    // te halen — die staan dan al achter ACTIVE-verlopen).
    auctions = auctions.sort((a, b) => {
      if (a.status !== b.status) return a.status.localeCompare(b.status);
      const aEnd = new Date(a.endTime).getTime();
      const bEnd = new Date(b.endTime).getTime();
      const nowMs = now.getTime();
      const aExpired = aEnd <= nowMs;
      const bExpired = bEnd <= nowMs;
      if (aExpired !== bExpired) return aExpired ? 1 : -1;
      return aEnd - bEnd;
    });
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const hasAuctions = auctions.length > 0;

  // Watchlist-IDs voor de huidige user — batch-load voor de hartjes-knop.
  let watchlistIds = new Set<string>();
  if (session?.user?.id && auctions.length > 0) {
    const watched = await prisma.watchlist.findMany({
      where: {
        userId: session.user.id,
        auctionId: { in: auctions.map((a) => a.id) },
      },
      select: { auctionId: true },
    });
    watchlistIds = new Set(
      watched.map((w) => w.auctionId).filter(Boolean) as string[],
    );
  }

  const buyerHasPostcode = !!buyerLocation?.postalCode;

  // Bouw extraParams voor pagination — alle filter-params behouden.
  const extraParams: Record<string, string> = { seed: String(seed) };
  if (sort !== "newest") extraParams.sort = sort;
  Object.entries(sp).forEach(([k, v]) => {
    if (k === "page" || k === "seed" || k === "sort") return;
    const value = Array.isArray(v) ? v[0] : v;
    if (value) extraParams[k] = value;
  });

  return (
    <PageContainer width="wide" className="py-8">
      <AuctionCreatedToast />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tc("auctions")}</h1>
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

      {/* Two-column layout: filter-sidebar + main content */}
      <div className="mt-6 flex gap-6">
        <VeilingenFilterSidebar buyerHasPostcode={buyerHasPostcode} />

        <div className="min-w-0 flex-1">
          {/* Toolbar: mobile-filter + view-toggle + sort */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <VeilingenMobileFilters buyerHasPostcode={buyerHasPostcode} />
            <AuctionViewToggle />
            <div className="ml-auto">
              <AuctionSortBar currentSort={sort} seed={seed} />
            </div>
          </div>

          {/* Sponsored row — alleen op pagina 1 zonder actieve filters */}
          {safePage === 1 && (
            <SponsoredAuctionRow
              auctions={sponsoredTop}
              title={t("sponsored")}
              tooltip={t("sponsoredTooltip")}
              buyer={buyerLocation}
            />
          )}

          {!hasAuctions ? (
            <div className="rounded-2xl border border-border bg-card p-12 text-center">
              <p className="text-muted-foreground">{tc("noResults")}</p>
              <Link
                href="/veilingen/nieuw"
                className="mt-4 inline-block text-sm font-medium text-primary hover:text-primary-hover transition-colors"
              >
                {t("createTitle")} &rarr;
              </Link>
            </div>
          ) : filters.view === "grid" ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 [@media(min-width:1600px)]:grid-cols-5">
                {auctions.map((auction) => (
                  <AuctionCard key={auction.id} auction={auction} buyer={buyerLocation} />
                ))}
              </div>
              <Pagination
                currentPage={safePage}
                totalPages={totalPages}
                baseUrl="/veilingen"
                locale={locale}
                extraParams={extraParams}
              />
            </>
          ) : (
            <>
              <div className="space-y-3">
                {auctions.map((auction) => (
                  <AuctionListRow
                    key={auction.id}
                    auction={auction}
                    locale={locale}
                    buyer={buyerLocation}
                    initialWatched={watchlistIds.has(auction.id)}
                    showWatchlist={!!session?.user?.id}
                  />
                ))}
              </div>
              <Pagination
                currentPage={safePage}
                totalPages={totalPages}
                baseUrl="/veilingen"
                locale={locale}
                extraParams={extraParams}
              />
            </>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
