import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BidSection } from "@/components/auction/bid-section";
import { CountdownTimer } from "@/components/auction/countdown-timer";
import { finalizeAuction } from "@/actions/auction";
import { ContactSellerButton } from "@/components/message/contact-seller-button";
import { ImageGallery } from "@/components/ui/image-gallery";
import { parseImageUrls } from "@/lib/upload";
import { WatchlistButton } from "@/components/ui/watchlist-button";
import { isWatched } from "@/actions/watchlist";
import { getAutoBid } from "@/actions/auction";
import { AutoBidForm } from "@/components/auction/autobid-form";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { SocialShare } from "@/components/ui/social-share";
import { ItemCarousel } from "@/components/ui/item-carousel";
import { getSellerOtherItems, getSimilarItems } from "@/lib/recommendations";

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
        include: { bidder: { select: { displayName: true } } },
      },
    },
  });

  if (!auction) notFound();

  const isOwner = session?.user?.id === auction.sellerId;
  const isActive = auction.status === "ACTIVE" && new Date() < auction.endTime;
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
                  {auction.auctionType === "SINGLE_CARD" ? t("singleCard") : auction.auctionType === "COLLECTION" ? t("collection") : t("bulk")}
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

          {/* Bid history */}
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t("bidHistory")}</h2>
            {auction.bids.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{t("noBids")}</p>
            ) : (
              <div className="mt-3 space-y-2">
                {auction.bids.map((bid, i) => (
                  <div key={bid.id} className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                    i === 0 ? "glass bg-primary-light/50 dark:bg-primary/10" : "glass-subtle"
                  }`}>
                    <span className="text-sm font-medium text-foreground">{bid.bidder.displayName}</span>
                    <div className="text-right">
                      <span className={`font-semibold ${i === 0 ? "text-primary" : "text-foreground"}`}>€{bid.amount.toFixed(2)}</span>
                      <p className="text-xs text-muted-foreground">{new Date(bid.createdAt).toLocaleString("nl-NL")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Bidding sidebar */}
        <div className="space-y-4">
          <div className="glass rounded-2xl p-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">{t("currentBid")}</p>
              <p className="mt-1 text-3xl font-bold text-foreground">
                €{(auction.currentBid ?? auction.startingBid).toFixed(2)}
              </p>
              {auction.currentBid === null && (
                <p className="mt-1 text-xs text-muted-foreground">{t("startingBid")}</p>
              )}
            </div>

            {/* Reserve status */}
            {auction.reservePrice !== null && (
              <div className="mt-3 text-center">
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                  (auction.currentBid ?? 0) >= auction.reservePrice
                    ? "bg-success-light text-success dark:bg-green-950 dark:text-green-400"
                    : "bg-warning-light text-warning dark:bg-yellow-950 dark:text-yellow-400"
                }`}>
                  {(auction.currentBid ?? 0) >= auction.reservePrice ? t("reserveMet") : t("reserveNotMet")}
                </span>
              </div>
            )}

            {/* Timer */}
            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">{t("timeLeft")}</p>
              <CountdownTimer endTime={auction.endTime.toISOString()} />
            </div>

            {/* Bid form */}
            {isActive && !isOwner && session?.user && (
              <div className="mt-6 space-y-4">
                <BidSection
                  auctionId={auction.id}
                  currentBid={auction.currentBid}
                  startingBid={auction.startingBid}
                  buyNowPrice={auction.buyNowPrice}
                />
                <AutoBidForm
                  auctionId={auction.id}
                  currentBid={auction.currentBid}
                  startingBid={auction.startingBid}
                  existingAutoBid={existingAutoBid ? { maxAmount: existingAutoBid.maxAmount, isActive: existingAutoBid.isActive } : null}
                />
              </div>
            )}

            {!session?.user && isActive && (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Log in om te bieden
              </p>
            )}

            {!isOwner && session?.user && (
              <div className="mt-4">
                <ContactSellerButton sellerId={auction.sellerId} auctionId={auction.id} />
              </div>
            )}

            {auction.status !== "ACTIVE" && (
              <div className="mt-4 text-center">
                <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
                  {t("ended")} — {auction.status}
                </span>
              </div>
            )}
          </div>

          {/* Social share */}
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
