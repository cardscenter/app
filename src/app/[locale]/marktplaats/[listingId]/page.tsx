import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ImageGallery } from "@/components/ui/image-gallery";
import { parseImageUrls } from "@/lib/upload";
import { ContactSellerButton } from "@/components/message/contact-seller-button";
import { ListingActions } from "@/components/listing/listing-actions";
import { ListingItemsList } from "@/components/listing/listing-items-list";
import { DescriptionEditor } from "@/components/listing/description-editor";
import { WatchlistButton } from "@/components/ui/watchlist-button";
import { isWatched } from "@/actions/watchlist";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { SocialShare } from "@/components/ui/social-share";
import { ItemCarousel } from "@/components/ui/item-carousel";
import { getSellerOtherItems, getSimilarItems } from "@/lib/recommendations";
import { SellerInfoBlock } from "@/components/ui/seller-info-block";
import { getSellerInfo } from "@/lib/seller-info";
import { PricingInfoBlock } from "@/components/ui/pricing-info-block";
import { getCardPricing } from "@/lib/card-helpers";
import { PageContainer } from "@/components/layout/page-container";

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
      cardItemRows: {
        select: { id: true, cardName: true, condition: true, quantity: true, status: true },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!listing) notFound();

  const images = parseImageUrls(listing.imageUrls);
  const isOwner = session?.user?.id === listing.sellerId;
  const isActive = listing.status === "ACTIVE";
  const isPartiallySold = listing.status === "PARTIALLY_SOLD";
  // Voor MULTI_CARD: counts voor titel-suffix (Fase 27.14). Reserved telt mee
  // als "nog niet verkocht" zodat de koper geen verkeerd beeld krijgt.
  const totalItems = listing.cardItemRows.length;
  const availableItems = listing.cardItemRows.filter(
    (i) => i.status === "AVAILABLE" || i.status === "RESERVED"
  ).length;
  // Server-side titel met automatische suffix bij PARTIALLY_SOLD. Niet
  // editeerbaar door seller — voorkomt dat een listing claimt nog
  // alles-bevattend te zijn terwijl een deel weg is.
  const displayTitle = isPartiallySold && totalItems > 0
    ? `${listing.title} ${t("titleSuffix.partiallySold", { available: availableItems, total: totalItems })}`
    : listing.title;
  const tCarousel = await getTranslations("carousel");
  const tBreadcrumbs = await getTranslations("breadcrumbs");
  const [watched, sellerItems, similarItems, sellerInfo, pricing] = await Promise.all([
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
    getCardPricing(listing.tcgdexId),
  ]);

  return (
    <PageContainer width="default" className="py-8">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs("marketplace"), href: "/marktplaats" },
          ...(listing.cardSet ? [{ label: listing.cardSet.name }] : []),
          { label: displayTitle },
        ]}
      />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left: Images & Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title above image */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{displayTitle}</h1>
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

          {/* Marktwaarde */}
          {pricing && (
            <PricingInfoBlock pricing={pricing} variant="full" label="Marktwaarde" />
          )}

          {/* Items-lijst voor MULTI_CARD listings (Fase 27.14) */}
          {listing.listingType === "MULTI_CARD" && listing.cardItemRows.length > 0 && (
            <ListingItemsList items={listing.cardItemRows} />
          )}

          {/* Description */}
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{t("description")}</h2>
              {isOwner && (isActive || isPartiallySold) && (
                <DescriptionEditor listingId={listing.id} initialDescription={listing.description} />
              )}
            </div>
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

            <div className="mt-3 text-center text-sm">
              {listing.freeShipping ? (
                <span className="font-medium text-green-600 dark:text-green-400">{t("freeShipping")}</span>
              ) : (
                <span className="text-muted-foreground">+ &euro;{listing.shippingCost.toFixed(2)} {t("shippingCost").toLowerCase()}</span>
              )}
            </div>

            {/* Status badge — niet-koopbare statussen */}
            {!isActive && !isPartiallySold && (
              <div className="mt-4 text-center">
                <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
                  {t(`status.${listing.status.toLowerCase()}`)}
                </span>
              </div>
            )}

            {/* PARTIALLY_SOLD-banner: koop kan alleen via chat (Fase 27.14) */}
            {isPartiallySold && (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-center text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                {t("partiallySoldHint", { available: availableItems, total: totalItems })}
              </div>
            )}

            {/* Contact seller — voor zowel ACTIVE als PARTIALLY_SOLD */}
            {(isActive || isPartiallySold) && !isOwner && session?.user && (
              <div className="mt-6">
                <ContactSellerButton sellerId={listing.sellerId} listingId={listing.id} />
              </div>
            )}

            {!session?.user && (isActive || isPartiallySold) && (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Log in om contact op te nemen
              </p>
            )}

            {/* Owner actions — status-aware (Fase 27) */}
            {isOwner && (listing.status === "ACTIVE" || listing.status === "PAUSED" || listing.status === "DRAFT" || listing.status === "RESERVED" || listing.status === "PARTIALLY_SOLD") && (
              <div className="mt-6">
                <ListingActions listingId={listing.id} status={listing.status as never} />
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
    </PageContainer>
  );
}
