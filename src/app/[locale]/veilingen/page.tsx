import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Clock, Plus } from "lucide-react";
import { AuctionCard } from "@/components/auction/auction-card";
import { SponsoredAuctionRow } from "@/components/auction/sponsored-row";
import { Pagination } from "@/components/ui/pagination";

const PAGE_SIZE = 40;

export default async function AuctionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);

  const t = await getTranslations("auction");
  const tc = await getTranslations("common");

  const now = new Date();

  // Sponsored auctions (active with CATEGORY_HIGHLIGHT upsell)
  const sponsoredAuctions = await prisma.auction.findMany({
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
    include: {
      seller: { select: { displayName: true } },
      _count: { select: { bids: true } },
    },
  });

  const sponsoredIds = sponsoredAuctions.map((a) => a.id);

  // Count non-sponsored active auctions
  const totalCount = await prisma.auction.count({
    where: {
      status: "ACTIVE",
      ...(sponsoredIds.length > 0 ? { id: { notIn: sponsoredIds } } : {}),
    },
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Paginated non-sponsored auctions
  const auctions = await prisma.auction.findMany({
    where: {
      status: "ACTIVE",
      ...(sponsoredIds.length > 0 ? { id: { notIn: sponsoredIds } } : {}),
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      seller: { select: { displayName: true } },
      _count: { select: { bids: true } },
    },
  });

  const hasAuctions = sponsoredAuctions.length > 0 || auctions.length > 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {tc("auctions")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("activeCount", { count: totalCount + sponsoredAuctions.length })}
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
            auctions={sponsoredAuctions}
            title={t("sponsored")}
            tooltip={t("sponsoredTooltip")}
          />

          {/* Main grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
          />
        </div>
      )}
    </div>
  );
}
