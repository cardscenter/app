import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { finalizeAuction } from "@/actions/auction";
import { ImageGallery } from "@/components/ui/image-gallery";
import { parseImageUrls } from "@/lib/upload";
import { WatchlistButton } from "@/components/ui/watchlist-button";
import { isWatched } from "@/actions/watchlist";
import { getAutoBid } from "@/actions/auction";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { SocialShare } from "@/components/ui/social-share";
import { ItemCarousel } from "@/components/ui/item-carousel";
import { getSellerOtherItems, getSimilarItems } from "@/lib/recommendations";
import { LiveAuctionContent } from "@/components/auction/live-auction-content";

export default async function AuctionDetailPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId } = await params;
  const session = await auth();
  const t = await getTranslations("auction");

  // Try to finalize if ended
  await finalizeAuction(auctionId);

  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      seller: { select: { displayName: true } },
      cardSet: { include: { series: true } },
      bids: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { bidder: { select: { displayName: true, id: true } } },
      },
    },
  });

  if (!auction) notFound();

  const isOwner = session?.user?.id === auction.sellerId;
  const tCarousel = await getTranslations("carousel");
  const tBreadcrumbs = await getTranslations("breadcrumbs");
  const [watched, existingAutoBid, sellerItems, similarItems] = await Promise.all([
    session?.user ? isWatched({ auctionId: auction.id }) : false,
    session?.user && !isOwner ? getAutoBid(auction.id) : null,
    getSellerOtherItems(auction.sellerId, { auctionId: auction.id }),
    getSimilarItems({
      cardSetId: auction.cardSetId,
      cardName: auction.cardName,
      sellerId: auction.sellerId,
      excludeId: auction.id,
      itemType: "auction",
    }),
  ]);

  const initialBids = auction.bids.map((b) => ({
    id: b.id,
    amount: b.amount,
    bidderName: b.bidder.displayName,
    createdAt: b.createdAt.toISOString(),
  }));

  const highestBidderId = auction.bids[0]?.bidderId ?? null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs("auctions"), href: "/veilingen" },
          ...(auction.cardSet ? [{ label: auction.cardSet.name }] : []),
          { label: auction.title },
        ]}
      />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left: Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image gallery */}
          {(() => {
            const imgs = parseImageUrls(auction.imageUrls);
            return imgs.length > 0 ? <ImageGallery images={imgs} alt={auction.title} /> : null;
          })()}

          <div>
            <div className="flex items-start justify-between">
              <div>
                <span className="rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-medium text-primary dark:bg-red-950 dark:text-red-400">
                  {auction.auctionType === "SINGLE_CARD"
                    ? t("singleCard")
                    : auction.auctionType === "COLLECTION"
                      ? t("collection")
                      : auction.auctionType === "SEALED_PRODUCT"
                        ? t("sealedProduct")
                        : auction.auctionType === "OTHER"
                          ? t("other")
                          : t("bulk")}
                </span>
                <h1 className="mt-2 text-2xl font-bold text-foreground">
                  {auction.title}
                </h1>
                <Link href={`/verkoper/${auction.sellerId}`} className="mt-1 inline-block text-sm text-primary hover:underline">
                  {auction.seller.displayName}
                </Link>
              </div>
              {session?.user && !isOwner && (
                <WatchlistButton auctionId={auction.id} initialWatched={watched} />
              )}
            </div>
          </div>

          {auction.cardName && (
            <div className="glass-subtle rounded-2xl p-4">
              <p className="text-xs text-muted-foreground">{t("cardName")}</p>
              <p className="font-medium text-foreground">{auction.cardName}</p>
              {auction.condition && <p className="text-sm text-muted-foreground mt-1">{t("condition")}: {auction.condition}</p>}
            </div>
          )}

          {auction.description && (
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t("description")}</h2>
              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{auction.description}</p>
            </div>
          )}
        </div>

        {/* Right: Live bidding sidebar */}
        <LiveAuctionContent
          auctionId={auction.id}
          sellerId={auction.sellerId}
          currentUserId={session?.user?.id ?? null}
          isOwner={isOwner}
          initialCurrentBid={auction.currentBid}
          startingBid={auction.startingBid}
          buyNowPrice={auction.buyNowPrice}
          endTime={auction.endTime.toISOString()}
          status={auction.status}
          reservePrice={auction.reservePrice}
          initialBids={initialBids}
          initialBidCount={auction.bids.length}
          initialHighestBidderId={highestBidderId}
          existingAutoBid={existingAutoBid ? { maxAmount: existingAutoBid.maxAmount, isActive: existingAutoBid.isActive } : null}
        />

        {/* Social share */}
        <div className="lg:col-span-1">
          <div className="glass-subtle rounded-2xl p-4">
            <SocialShare title={auction.title} />
          </div>
        </div>
      </div>

      {/* Carousels */}
      <ItemCarousel
        title={tCarousel("otherItemsBySeller")}
        items={sellerItems}
      />
      <ItemCarousel
        title={tCarousel("similarItems")}
        items={similarItems}
      />
    </div>
  );
}
