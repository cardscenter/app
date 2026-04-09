import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { ListingCard } from "@/components/listing/listing-card";
import { SponsoredRow } from "@/components/listing/sponsored-row";
import { Pagination } from "@/components/ui/pagination";
import { Link } from "@/i18n/navigation";
import { Plus } from "lucide-react";
import { ListingSortBar } from "@/components/listing/listing-sort-bar";

const PAGE_SIZE = 40;

export default async function MarktplaatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations("listing");

  const currentPage = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  type SortOption = "newest" | "price_asc" | "price_desc";
  const sort = (["newest", "price_asc", "price_desc"].includes(sp.sort ?? "")
    ? sp.sort
    : "newest") as SortOption;

  function getListingOrderBy(s: SortOption) {
    switch (s) {
      case "price_asc": return { price: "asc" as const };
      case "price_desc": return { price: "desc" as const };
      default: return { createdAt: "desc" as const };
    }
  }
  const orderBy = getListingOrderBy(sort);
  const now = new Date();

  // Fetch sponsored listings (active CATEGORY_HIGHLIGHT upsell)
  const sponsoredListings = await prisma.listing.findMany({
    where: {
      status: "ACTIVE",
      upsells: {
        some: {
          type: "CATEGORY_HIGHLIGHT",
          expiresAt: { gt: now },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      seller: { select: { displayName: true, isVerified: true } },
      upsells: { where: { expiresAt: { gt: now } }, select: { type: true, expiresAt: true } },
    },
  });

  const sponsoredIds = sponsoredListings.map((l) => l.id);

  // Count total non-sponsored active listings
  const totalCount = await prisma.listing.count({
    where: {
      status: "ACTIVE",
      ...(sponsoredIds.length > 0 ? { id: { notIn: sponsoredIds } } : {}),
    },
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  // Fetch paginated main listings (excluding sponsored)
  const listings = await prisma.listing.findMany({
    where: {
      status: "ACTIVE",
      ...(sponsoredIds.length > 0 ? { id: { notIn: sponsoredIds } } : {}),
    },
    orderBy,
    skip: (safePage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      seller: { select: { displayName: true, isVerified: true } },
      upsells: { where: { expiresAt: { gt: now } }, select: { type: true, expiresAt: true } },
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("browseTitle")}
          </h1>
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

      {/* Sort bar */}
      <div className="mt-6">
        <ListingSortBar currentSort={sort} />
      </div>

      <div className="mt-8">
      {/* Sponsored row */}
      <SponsoredRow
        listings={sponsoredListings}
        locale={locale}
        title={t("sponsored")}
        tooltip={t("sponsoredTooltip")}
      />

      {listings.length === 0 && sponsoredListings.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <p className="text-muted-foreground">{t("noListings")}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} locale={locale} />
            ))}
          </div>

          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            baseUrl="/marktplaats"
            locale={locale}
            extraParams={sort !== "newest" ? { sort } : {}}
          />
        </>
      )}
      </div>
    </div>
  );
}
