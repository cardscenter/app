import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ClaimsaleActions } from "@/components/claimsale/claimsale-actions";
import { ContactSellerButton } from "@/components/message/contact-seller-button";
import { ClaimsaleItemsFilter } from "@/components/claimsale/claimsale-items-filter";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { SocialShare } from "@/components/ui/social-share";
import { ItemCarousel } from "@/components/ui/item-carousel";
import { getSellerOtherItems } from "@/lib/recommendations";

export default async function ClaimsaleDetailPage({
  params,
}: {
  params: Promise<{ claimsaleId: string }>;
}) {
  const { claimsaleId } = await params;
  const session = await auth();
  const t = await getTranslations("claimsale");

  const claimsale = await prisma.claimsale.findUnique({
    where: { id: claimsaleId },
    include: {
      seller: { select: { displayName: true } },
      items: {
        include: {
          cardSet: { include: { series: { include: { category: true } } } },
          buyer: { select: { displayName: true } },
        },
        orderBy: { cardName: "asc" },
      },
    },
  });

  if (!claimsale) notFound();

  const isOwner = session?.user?.id === claimsale.sellerId;
  const availableCount = claimsale.items.filter((i) => i.status === "AVAILABLE").length;
  const tCarousel = await getTranslations("carousel");
  const tBreadcrumbs = await getTranslations("breadcrumbs");
  const sellerItems = await getSellerOtherItems(claimsale.sellerId, { claimsaleId: claimsale.id });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs("claimsales"), href: "/claimsales" },
          { label: claimsale.title },
        ]}
      />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {claimsale.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {claimsale.seller.displayName} · {availableCount}/{claimsale.items.length} {t("available").toLowerCase()} · {t("shippingCost")}: €{claimsale.shippingCost.toFixed(2)}
          </p>
        </div>

        {isOwner ? (
          <ClaimsaleActions claimsaleId={claimsale.id} status={claimsale.status} />
        ) : session?.user ? (
          <ContactSellerButton sellerId={claimsale.sellerId} claimsaleId={claimsale.id} />
        ) : null}
      </div>

      {claimsale.description && (
        <p className="mt-4 whitespace-pre-wrap text-muted-foreground">
          {claimsale.description}
        </p>
      )}

      <div className="mt-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
        {t("shippingNote")}
      </div>

      {/* Social share */}
      <div className="mt-4">
        <SocialShare title={claimsale.title} />
      </div>

      {/* Items table with client-side filtering */}
      <div className="mt-6">
        <ClaimsaleItemsFilter
          items={claimsale.items.map((item) => ({
            id: item.id,
            cardName: item.cardName,
            condition: item.condition,
            price: item.price,
            status: item.status,
            cardSet: {
              name: item.cardSet.name,
              series: {
                category: { name: item.cardSet.series.category.name },
              },
            },
            buyer: item.buyer,
          }))}
          isOwner={isOwner}
          isLive={claimsale.status === "LIVE"}
          hasSession={!!session?.user}
        />
      </div>

      {/* Carousel */}
      <ItemCarousel
        title={tCarousel("otherItemsBySeller")}
        items={sellerItems}
      />
    </div>
  );
}
