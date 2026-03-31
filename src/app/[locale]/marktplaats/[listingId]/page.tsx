import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ImageGallery } from "@/components/ui/image-gallery";
import { parseImageUrls } from "@/lib/upload";
import { ContactSellerButton } from "@/components/message/contact-seller-button";
import { ListingActions } from "@/components/listing/listing-actions";
import { WatchlistButton } from "@/components/ui/watchlist-button";
import { isWatched } from "@/actions/watchlist";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { SocialShare } from "@/components/ui/social-share";
import { ItemCarousel } from "@/components/ui/item-carousel";
import { getSellerOtherItems, getSimilarItems } from "@/lib/recommendations";
import { SellerInfoBlock } from "@/components/ui/seller-info-block";
import { getSellerInfo } from "@/lib/seller-info";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;
  const session = await auth();
  const t = await getTranslations("listing");

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      seller: { select: { id: true, displayName: true } },
      cardSet: { include: { series: true } },
    },
  });

  if (!listing) notFound();

  const images = parseImageUrls(listing.imageUrls);
  const isOwner = session?.user?.id === listing.sellerId;
  const isActive = listing.status === "ACTIVE";
  const tCarousel = await getTranslations("carousel");
  const tBreadcrumbs = await getTranslations("breadcrumbs");
  const [watched, sellerItems, similarItems, sellerInfo] = await Promise.all([
    session?.user ? isWatched({ listingId: listing.id }) : false,
    getSellerOtherItems(listing.sellerId, { listingId: listing.id }),
    getSimilarItems({
      cardSetId: listing.cardSetId,
      cardName: listing.cardName,
      sellerId: listing.sellerId,
      excludeId: listing.id,
      itemType: "listing",
    }),
    getSellerInfo(listing.sellerId),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs("marketplace"), href: "/marktplaats" },
          ...(listing.cardSet ? [{ label: listing.cardSet.name }] : []),
          { label: listing.title },
        ]}
      />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left: Images & Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title above image */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{listing.title}</h1>
              <Link href={`/verkoper/${listing.sellerId}`} className="mt-1 inline-block text-sm text-primary hover:underline">
                {listing.seller.displayName}
              </Link>
            </div>
            {session?.user && !isOwner && (
              <WatchlistButton listingId={listing.id} initialWatched={watched} />
            )}
          </div>

          {images.length > 0 && <ImageGallery images={images} alt={listing.title} />}

          {/* Card info */}
          <div className="glass-subtle rounded-2xl p-4 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {listing.cardName && (
                <div>
                  <p className="text-muted-foreground">{t("cardName")}</p>
                  <p className="font-medium text-foreground">{listing.cardName}</p>
                </div>
              )}
              {listing.condition && (
                <div>
                  <p className="text-muted-foreground">{t("condition")}</p>
                  <p className="font-medium text-foreground">{listing.condition}</p>
                </div>
              )}
              {listing.cardSet && (
                <div>
                  <p className="text-muted-foreground">{t("set")}</p>
                  <p className="font-medium text-foreground">{listing.cardSet.name}</p>
                </div>
              )}
              {listing.cardSet?.series && (
                <div>
                  <p className="text-muted-foreground">{t("series")}</p>
                  <p className="font-medium text-foreground">{listing.cardSet.series.name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t("description")}</h2>
            <div className="mt-2 whitespace-pre-wrap text-muted-foreground prose prose-sm dark:prose-invert max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: listing.description }} />
          </div>
        </div>

        {/* Right: Pricing sidebar */}
        <div className="space-y-4">
          <div className="glass rounded-2xl p-6">
            <div className="text-center">
              {listing.pricingType === "FIXED" ? (
                <>
                  <p className="text-sm text-muted-foreground">{t("price")}</p>
                  <p className="mt-1 text-3xl font-bold text-foreground">
                    &euro;{listing.price?.toFixed(2)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">{t("pricingType")}</p>
                  <p className="mt-1 text-xl font-bold text-foreground">{t("negotiable")}</p>
                </>
              )}
            </div>

            <div className="mt-3 text-center text-sm text-muted-foreground">
              + &euro;{listing.shippingCost.toFixed(2)} {t("shippingCost").toLowerCase()}
            </div>

            {/* Status badge */}
            {!isActive && (
              <div className="mt-4 text-center">
                <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
                  {listing.status === "SOLD" ? t("sold") : listing.status}
                </span>
              </div>
            )}

            {/* Contact seller */}
            {isActive && !isOwner && session?.user && (
              <div className="mt-6">
                <ContactSellerButton sellerId={listing.sellerId} listingId={listing.id} />
              </div>
            )}

            {!session?.user && isActive && (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Log in om contact op te nemen
              </p>
            )}

            {/* Owner actions */}
            {isOwner && isActive && (
              <div className="mt-6">
                <ListingActions listingId={listing.id} />
              </div>
            )}
          </div>

          {/* Seller Info Block */}
          {sellerInfo && <SellerInfoBlock seller={sellerInfo} />}

          {/* Social share */}
          <div className="glass-subtle rounded-2xl p-4">
            <SocialShare title={listing.title} />
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
