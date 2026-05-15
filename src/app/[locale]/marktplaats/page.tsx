import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { ListingCard } from "@/components/listing/listing-card";
import { ListingListRow } from "@/components/listing/listing-list-row";
import { SponsoredRow } from "@/components/listing/sponsored-row";
import { Pagination } from "@/components/ui/pagination";
import { Link } from "@/i18n/navigation";
import { Plus } from "lucide-react";
import { ListingSortBar } from "@/components/listing/listing-sort-bar";
import { ListingViewToggle } from "@/components/listing/listing-view-toggle";
import { MarktplaatsFilterSidebar } from "@/components/listing/marktplaats-filter-sidebar";
import { MarktplaatsMobileFilters } from "@/components/listing/marktplaats-mobile-filters";
import { getBuyerLocation, getSellerCountryFilter } from "@/lib/shipping/filter";
import { auth } from "@/lib/auth";
import { getBlockedUserIds, sellerNotInBlockedFilter } from "@/lib/blocking";
import { PageContainer } from "@/components/layout/page-container";
import { parseListingFilters, buildListingFilterWhere } from "@/lib/listing-filters";
import { distanceKm } from "@/lib/distance";

const PAGE_SIZE = 40;

export default async function MarktplaatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations("listing");

  const pageRaw = typeof sp.page === "string" ? sp.page : undefined;
  const sortRaw = typeof sp.sort === "string" ? sp.sort : undefined;
  const currentPage = Math.max(1, parseInt(pageRaw ?? "1", 10) || 1);
  type SortOption = "newest" | "price_asc" | "price_desc";
  const sort = (["newest", "price_asc", "price_desc"].includes(sortRaw ?? "")
    ? sortRaw
    : "newest") as SortOption;

  // Tier-based search-boost (Fase 31): tier-key is altijd SECONDARY zodat de
  // gekozen sort dominant blijft. Tier-boost grijpt alleen bij ties op de
  // primary sort (zeldzaam bij datum, vaker bij identieke prijs). Effect:
  // FREE-users verliezen geen page-1-positie, maar Unlimited krijgt bij
  // gelijke gevallen voorrang.
  function getListingOrderBy(s: SortOption) {
    switch (s) {
      case "price_asc":
        return [{ price: "asc" as const }, { seller: { tierRank: "desc" as const } }, { createdAt: "desc" as const }];
      case "price_desc":
        return [{ price: "desc" as const }, { seller: { tierRank: "desc" as const } }, { createdAt: "desc" as const }];
      default:
        return [{ createdAt: "desc" as const }, { seller: { tierRank: "desc" as const } }];
    }
  }
  const orderBy = getListingOrderBy(sort);
  const now = new Date();

  // Buyer location → distance + country-filter.
  const buyerLocation = await getBuyerLocation();
  const buyerCountry = buyerLocation?.country ?? null;
  const countryFilter = getSellerCountryFilter(buyerCountry);

  // Hide listings from sellers I've blocked + sellers who blocked me.
  const session = await auth();
  const blockedIds = await getBlockedUserIds(session?.user?.id);
  const sellerFilter = sellerNotInBlockedFilter(blockedIds);
  const blockingFilter = sellerFilter ? { sellerId: sellerFilter } : {};

  // Filter-state uit de URL parsen + Prisma-where bouwen.
  const filters = parseListingFilters(sp);
  const filterWhere = buildListingFilterWhere(filters);

  // Sponsored listings — niet aan filters onderworpen, blijven altijd zichtbaar
  // (anders heeft een bedrijf geen ROI op de slot).
  const sponsoredListings = await prisma.listing.findMany({
    where: {
      status: { in: ["ACTIVE", "PARTIALLY_SOLD"] },
      ...countryFilter,
      ...blockingFilter,
      upsells: {
        some: { type: "CATEGORY_HIGHLIGHT", expiresAt: { gt: now } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      seller: {
        select: {
          displayName: true,
          isVerified: true,
          city: true,
          postalCode: true,
          country: true,
        },
      },
      upsells: {
        where: { expiresAt: { gt: now } },
        select: { type: true, expiresAt: true },
      },
      labels: { select: { type: true, colorKey: true } },
      _count: {
        select: { cardItemRows: { where: { status: "AVAILABLE" } } },
      },
    },
  });
  const sponsoredIds = sponsoredListings.map((l) => l.id);

  // Combineer alle filters voor de hoofdlijst.
  const baseWhere = {
    status: { in: ["ACTIVE", "PARTIALLY_SOLD"] as string[] },
    ...countryFilter,
    ...blockingFilter,
    ...filterWhere,
    ...(sponsoredIds.length > 0 ? { id: { notIn: sponsoredIds } } : {}),
  };

  // Radius-filter: SQLite kan geen haversine, dus we doen post-filter in JS.
  // Alleen mogelijk als buyer een postcode heeft. We fetchen een redelijke
  // bovengrens en filteren dan; pageination werkt nog op het gefilterde resultaat.
  // Voor nu: als radius gezet is, fetchen we tot 500 listings, filteren, en
  // pagineren in JS. Voor productie met >500 listings binnen radius kan dit
  // weer naar een spatial-index toe.
  const useRadiusPostFilter =
    filters.radius !== null && buyerLocation?.postalCode && buyerCountry;

  const LISTING_INCLUDE = {
    seller: {
      select: {
        displayName: true,
        isVerified: true,
        city: true,
        postalCode: true,
        country: true,
      },
    },
    upsells: {
      where: { expiresAt: { gt: now } },
      select: { type: true, expiresAt: true },
    },
    labels: { select: { type: true, colorKey: true } },
    _count: {
      select: { cardItemRows: { where: { status: "AVAILABLE" } } },
    },
  } satisfies Prisma.ListingInclude;
  type ListingPayload = Prisma.ListingGetPayload<{ include: typeof LISTING_INCLUDE }>;

  let totalCount: number;
  let listings: ListingPayload[];

  if (useRadiusPostFilter) {
    const candidates = await prisma.listing.findMany({
      where: baseWhere,
      orderBy,
      take: 500,
      include: LISTING_INCLUDE,
    });
    const filtered = candidates.filter((l) => {
      const km = distanceKm({
        buyerCountry,
        buyerPostalCode: buyerLocation!.postalCode,
        sellerCountry: l.seller.country,
        sellerPostalCode: l.seller.postalCode,
      });
      if (km === null) return false;
      return km <= filters.radius!;
    });
    totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const safePage = Math.min(currentPage, totalPages);
    listings = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  } else {
    totalCount = await prisma.listing.count({ where: baseWhere });
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const safePage = Math.min(currentPage, totalPages);
    listings = await prisma.listing.findMany({
      where: baseWhere,
      orderBy,
      skip: (safePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: LISTING_INCLUDE,
    });
  }
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  // Watchlist-IDs voor de huidige user — batch-load voor de hartjes-knop.
  let watchlistIds = new Set<string>();
  if (session?.user?.id && listings.length > 0) {
    const watched = await prisma.watchlist.findMany({
      where: {
        userId: session.user.id,
        listingId: { in: listings.map((l) => l.id) },
      },
      select: { listingId: true },
    });
    watchlistIds = new Set(watched.map((w) => w.listingId).filter(Boolean) as string[]);
  }

  // Verrijk met availableStock voor SEALED/OTHER stock-badge.
  const enrichedListings = listings.map((l) => ({
    ...l,
    availableStock:
      l.listingType === "SEALED_PRODUCT" || l.listingType === "OTHER"
        ? l._count.cardItemRows
        : undefined,
  }));

  // Interleave: weeft sponsored-listings na elke 10 organische items in de
  // hoofdlijst zodat sponsored ook midden in de pagina zichtbaar is, niet
  // alleen in de top-row. Sponsored-cards krijgen amber border + "Gesponsord"-pill.
  const enrichedSponsored = sponsoredListings.map((l) => ({
    ...l,
    availableStock:
      l.listingType === "SEALED_PRODUCT" || l.listingType === "OTHER"
        ? l._count.cardItemRows
        : undefined,
  }));
  type DisplayItem = { kind: "organic" | "sponsored"; listing: typeof enrichedListings[0] };
  const displayItems: DisplayItem[] = [];
  let sponsoredIdx = 0;
  for (let i = 0; i < enrichedListings.length; i++) {
    displayItems.push({ kind: "organic", listing: enrichedListings[i] });
    if ((i + 1) % 10 === 0 && enrichedSponsored.length > 0) {
      const sponsored = enrichedSponsored[sponsoredIdx % enrichedSponsored.length];
      displayItems.push({ kind: "sponsored", listing: sponsored });
      sponsoredIdx++;
    }
  }

  const buyerHasPostcode = !!buyerLocation?.postalCode;

  // Bouw extraParams voor pagination — alle filter-params behouden bij navigatie.
  const extraParams: Record<string, string> = {};
  Object.entries(sp).forEach(([k, v]) => {
    if (k === "page") return;
    const value = Array.isArray(v) ? v[0] : v;
    if (value) extraParams[k] = value;
  });

  return (
    <PageContainer width="wide" className="py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("browseTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("activeCount", { count: totalCount })}
          </p>
        </div>
        <Link
          href="/marktplaats/nieuw"
          className="inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-emerald-700 hover:shadow-lg"
        >
          <Plus className="size-4 mr-1" />
          {t("createTitle")}
        </Link>
      </div>

      {/* Two-column layout: filter-sidebar + main content */}
      <div className="mt-6 flex gap-6">
        <MarktplaatsFilterSidebar buyerHasPostcode={buyerHasPostcode} />

        <div className="min-w-0 flex-1">
          {/* Toolbar: mobile-filter + view-toggle + sort */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <MarktplaatsMobileFilters buyerHasPostcode={buyerHasPostcode} />
            <ListingViewToggle />
            <div className="ml-auto">
              <ListingSortBar currentSort={sort} />
            </div>
          </div>

          {/* Sponsored row — alleen op pagina 1 zonder actieve filters */}
          {safePage === 1 && (
            <SponsoredRow
              listings={sponsoredListings}
              locale={locale}
              title={t("sponsored")}
              tooltip={t("sponsoredTooltip")}
              buyer={buyerLocation}
            />
          )}

          {listings.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-12 text-center">
              <p className="text-muted-foreground">{t("noListings")}</p>
            </div>
          ) : filters.view === "grid" ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 [@media(min-width:1600px)]:grid-cols-5">
                {displayItems.map((item, idx) => (
                  <ListingCard
                    key={`${item.kind}-${item.listing.id}-${idx}`}
                    listing={item.listing}
                    locale={locale}
                    buyer={buyerLocation}
                    isSponsored={item.kind === "sponsored"}
                  />
                ))}
              </div>
              <Pagination
                currentPage={safePage}
                totalPages={totalPages}
                baseUrl="/marktplaats"
                locale={locale}
                extraParams={extraParams}
              />
            </>
          ) : (
            <>
              <div className="space-y-3">
                {displayItems.map((item, idx) => (
                  <ListingListRow
                    key={`${item.kind}-${item.listing.id}-${idx}`}
                    listing={item.listing}
                    locale={locale}
                    buyer={buyerLocation}
                    initialWatched={watchlistIds.has(item.listing.id)}
                    showWatchlist={!!session?.user?.id}
                    isSponsored={item.kind === "sponsored"}
                  />
                ))}
              </div>
              <Pagination
                currentPage={safePage}
                totalPages={totalPages}
                baseUrl="/marktplaats"
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
