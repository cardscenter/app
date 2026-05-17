import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ShoppingBag, Plus } from "lucide-react";
import { ClaimsaleListRow } from "@/components/claimsale/claimsale-list-row";
import { ClaimsalesFilterSidebar } from "@/components/claimsale/claimsales-filter-sidebar";
import { ClaimsalesMobileFilters } from "@/components/claimsale/claimsales-mobile-filters";
import { SponsoredClaimsaleRow } from "@/components/claimsale/sponsored-row";
import { Pagination } from "@/components/ui/pagination";
import { getBuyerLocation, getSellerCountryFilter } from "@/lib/shipping/filter";
import { auth } from "@/lib/auth";
import { getBlockedUserIds, sellerNotInBlockedFilter } from "@/lib/blocking";
import { PageContainer } from "@/components/layout/page-container";
import {
  parseClaimsaleFilters,
  buildClaimsaleFilterWhere,
  countActiveClaimsaleFilters,
} from "@/lib/claimsale-filters";
import { distanceKm } from "@/lib/distance";

const CLAIMSALE_INCLUDE = {
  seller: {
    select: {
      displayName: true,
      isVerified: true,
      city: true,
      postalCode: true,
      country: true,
    },
  },
  _count: { select: { items: true } },
  items: {
    where: { status: "AVAILABLE" },
    select: {
      id: true,
      cardName: true,
      condition: true,
      price: true,
      imageUrls: true,
      status: true,
    },
    orderBy: { price: "desc" },
  },
  labels: { select: { type: true, colorKey: true } },
  upsells: {
    where: { expiresAt: { gt: new Date() } },
    select: { type: true, startsAt: true, expiresAt: true },
  },
} satisfies Prisma.ClaimsaleInclude;

const PAGE_SIZE = 40;

export default async function ClaimsalesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const tc = await getTranslations("common");
  const t = await getTranslations("claimsale");

  const pageRaw = typeof sp.page === "string" ? sp.page : undefined;
  const currentPage = Math.max(1, parseInt(pageRaw ?? "1", 10) || 1);

  // Buyer-location → distance + country-filter.
  const buyerLocation = await getBuyerLocation();
  const buyerCountry = buyerLocation?.country ?? null;
  const countryFilter = getSellerCountryFilter(buyerCountry);

  // Hide claimsales from blocked sellers (both directions).
  const session = await auth();
  const blockedIds = await getBlockedUserIds(session?.user?.id);
  const sellerFilter = sellerNotInBlockedFilter(blockedIds);
  const blockingFilter = sellerFilter ? { sellerId: sellerFilter } : {};

  // Filter-state uit URL.
  const filters = parseClaimsaleFilters(sp);
  const filterWhere = buildClaimsaleFilterWhere(filters);

  const baseWhere: Prisma.ClaimsaleWhereInput = {
    status: { in: ["LIVE", "SCHEDULED"] },
    ...countryFilter,
    ...blockingFilter,
    ...filterWhere,
  };

  // Radius post-filter — SQLite kan geen haversine. itemCountMin & price-sort
  // zouden ook in JS kunnen, maar voor v1 doet alleen radius post-filter mee.
  const useRadiusPostFilter =
    filters.radius !== null && buyerLocation?.postalCode && buyerCountry;
  const useItemCountFilter = filters.itemCountMin !== null;

  // Standaard orderBy: tier-boost als secondary achter publishedAt.
  const orderBy = [
    { publishedAt: "desc" as const },
    { seller: { tierRank: "desc" as const } },
  ];

  let totalCount: number;
  let claimsales: Prisma.ClaimsaleGetPayload<{ include: typeof CLAIMSALE_INCLUDE }>[];

  // Strategie:
  //  - Als radius of itemCountMin actief: fetch tot 500, post-filter in JS,
  //    paginate in JS.
  //  - Anders: standard count + paginated query.
  if (useRadiusPostFilter || useItemCountFilter) {
    const candidates = await prisma.claimsale.findMany({
      where: baseWhere,
      orderBy,
      take: 500,
      include: CLAIMSALE_INCLUDE,
    });
    let filtered = candidates;
    if (useItemCountFilter) {
      filtered = filtered.filter(
        (c) => c._count.items >= (filters.itemCountMin ?? 0),
      );
    }
    if (useRadiusPostFilter) {
      filtered = filtered.filter((c) => {
        const km = distanceKm({
          buyerCountry,
          buyerPostalCode: buyerLocation!.postalCode,
          sellerCountry: c.seller.country,
          sellerPostalCode: c.seller.postalCode,
        });
        if (km === null) return false;
        return km <= filters.radius!;
      });
    }
    totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const safePage = Math.min(currentPage, totalPages);
    claimsales = filtered.slice(
      (safePage - 1) * PAGE_SIZE,
      safePage * PAGE_SIZE,
    );
  } else {
    totalCount = await prisma.claimsale.count({ where: baseWhere });
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const safePage = Math.min(currentPage, totalPages);
    claimsales = await prisma.claimsale.findMany({
      where: baseWhere,
      orderBy,
      skip: (safePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: CLAIMSALE_INCLUDE,
    });
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  // Watchlist-IDs voor de huidige user — batch-load voor de hartjes-knop.
  let watchlistIds = new Set<string>();
  if (session?.user?.id && claimsales.length > 0) {
    const watched = await prisma.watchlist.findMany({
      where: {
        userId: session.user.id,
        claimsaleId: { in: claimsales.map((c) => c.id) },
      },
      select: { claimsaleId: true },
    });
    watchlistIds = new Set(
      watched.map((w) => w.claimsaleId).filter(Boolean) as string[],
    );
  }

  const buyerHasPostcode = !!buyerLocation?.postalCode;

  // Pagination behoudt alle filter-params.
  const extraParams: Record<string, string> = {};
  Object.entries(sp).forEach(([k, v]) => {
    if (k === "page") return;
    const value = Array.isArray(v) ? v[0] : v;
    if (value) extraParams[k] = value;
  });

  // Sponsored-row: claimsales met een actieve CATEGORY_HIGHLIGHT-upsell.
  // Alleen op page 1 zonder actieve filters.
  const showSponsored = safePage === 1 && countActiveClaimsaleFilters(filters) === 0;
  const sponsoredClaimsales = showSponsored
    ? await prisma.claimsale.findMany({
        where: {
          status: { in: ["LIVE", "SCHEDULED"] },
          ...countryFilter,
          ...blockingFilter,
          upsells: {
            some: {
              type: "CATEGORY_HIGHLIGHT",
              startsAt: { lte: new Date() },
              expiresAt: { gt: new Date() },
            },
          },
        },
        orderBy: { publishedAt: "desc" },
        take: 8,
        include: CLAIMSALE_INCLUDE,
      })
    : [];

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
          href="/claimsales/nieuw"
          className="inline-flex items-center rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-amber-700 hover:shadow-lg"
        >
          <Plus className="size-4 mr-1" />
          {t("createTitle")}
        </Link>
      </div>

      {/* Two-column layout: filter-sidebar + main content */}
      <div className="mt-6 flex gap-6">
        <ClaimsalesFilterSidebar buyerHasPostcode={buyerHasPostcode} />

        <div className="min-w-0 flex-1">
          {/* Toolbar: alleen mobile-filter — claimsales hebben geen grid-view
              (te druk visueel, lijst toont items + prijzen veel beter). */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <ClaimsalesMobileFilters buyerHasPostcode={buyerHasPostcode} />
          </div>

          {sponsoredClaimsales.length > 0 && (
            <SponsoredClaimsaleRow
              claimsales={sponsoredClaimsales}
              title={t("sponsoredBadge")}
              tooltip={t("promotieIntro")}
              buyer={buyerLocation}
            />
          )}

          {claimsales.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-12 text-center">
              <div className="mx-auto inline-flex rounded-full bg-secondary p-4">
                <ShoppingBag className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{tc("noResults")}</p>
              <Link
                href="/claimsales/nieuw"
                className="mt-4 inline-block text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors"
              >
                {t("createTitle")} &rarr;
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {claimsales.map((cs) => (
                  <ClaimsaleListRow
                    key={cs.id}
                    claimsale={cs}
                    locale={locale}
                    buyer={buyerLocation}
                    initialWatched={watchlistIds.has(cs.id)}
                    showWatchlist={!!session?.user?.id}
                  />
                ))}
              </div>
              <Pagination
                currentPage={safePage}
                totalPages={totalPages}
                baseUrl="/claimsales"
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
