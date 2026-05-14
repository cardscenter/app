import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ClaimsaleActions } from "@/components/claimsale/claimsale-actions";
import { ContactSellerButton } from "@/components/message/contact-seller-button";
import { ClaimsaleItemsFilter } from "@/components/claimsale/claimsale-items-filter";
import { LiveClaimsaleItems } from "@/components/claimsale/live-claimsale-items";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { SocialShare } from "@/components/ui/social-share";
import { ItemCarousel } from "@/components/ui/item-carousel";
import { getSellerOtherItems } from "@/lib/recommendations";
import { SellerInfoBlock } from "@/components/ui/seller-info-block";
import { getSellerInfo } from "@/lib/seller-info";
import { PageContainer } from "@/components/layout/page-container";
import { ClaimsaleLabels } from "@/components/claimsale/claimsale-labels";
import { ClaimsalePromotionManager } from "@/components/claimsale/claimsale-promotion-manager";
import { Clock } from "lucide-react";
import { formatNLDateTime } from "@/lib/claimsale/timing";

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
      labels: { select: { type: true, colorKey: true } },
      upsells: {
        where: { expiresAt: { gt: new Date() } },
        select: { id: true, type: true, startsAt: true, expiresAt: true, totalCost: true },
      },
      items: {
        include: {
          cardSet: { include: { series: { include: { category: true } } } },
          buyer: { select: { displayName: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!claimsale) notFound();

  const isOwner = session?.user?.id === claimsale.sellerId;
  const isScheduled = claimsale.status === "SCHEDULED";
  const availableCount = claimsale.items.filter((i) => i.status === "AVAILABLE" || i.status === "CLAIMED").length;
  const tCarousel = await getTranslations("carousel");
  const tBreadcrumbs = await getTranslations("breadcrumbs");
  const [sellerInfo, sellerItems] = await Promise.all([
    getSellerInfo(claimsale.sellerId),
    getSellerOtherItems(claimsale.sellerId, { claimsaleId: claimsale.id }),
  ]);

  return (
    <PageContainer width="default" className="py-8">
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
          {claimsale.labels.length > 0 && (
            <ClaimsaleLabels labels={claimsale.labels} size="md" className="mt-2" />
          )}
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

      {isScheduled && claimsale.startTime && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-indigo-300 bg-indigo-50 p-3 text-sm dark:border-indigo-800/50 dark:bg-indigo-950/20">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
          <p className="text-indigo-800 dark:text-indigo-300">
            {t("scheduledStartHint", { date: formatNLDateTime(claimsale.startTime) })}
          </p>
        </div>
      )}

      {claimsale.description && (
        <p className="mt-4 whitespace-pre-wrap text-muted-foreground">
          {claimsale.description}
        </p>
      )}

      <div className="mt-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
        {t("shippingNote")}
      </div>

      {isOwner && (isScheduled || claimsale.status === "LIVE") && (
        <div className="mt-4">
          <ClaimsalePromotionManager
            claimsaleId={claimsale.id}
            upsells={claimsale.upsells.map((u) => ({
              id: u.id,
              type: u.type,
              startsAt: u.startsAt.toISOString(),
              expiresAt: u.expiresAt.toISOString(),
              totalCost: u.totalCost,
            }))}
          />
        </div>
      )}

      {/* Seller info */}
      {sellerInfo && (
        <div className="mt-6">
          <SellerInfoBlock seller={sellerInfo} />
        </div>
      )}

      {/* Items table with client-side filtering */}
      <div className="mt-6">
        {claimsale.status === "LIVE" ? (
          <LiveClaimsaleItems
            claimsaleId={claimsale.id}
            initialItems={claimsale.items.map((item) => ({
              id: item.id,
              cardName: item.cardName,
              condition: item.condition,
              price: item.price,
              status: item.status,
              imageUrls: item.imageUrls,
              cardSet: item.cardSet ? {
                name: item.cardSet.name,
                series: {
                  category: { name: item.cardSet.series.category.name },
                },
              } : null,
              buyer: item.buyer,
            }))}
            isOwner={isOwner}
            isLive={true}
            hasSession={!!session?.user}
          />
        ) : (
          <ClaimsaleItemsFilter
            claimsaleId={claimsale.id}
            items={claimsale.items.map((item) => ({
              id: item.id,
              cardName: item.cardName,
              condition: item.condition,
              price: item.price,
              status: item.status,
              imageUrls: item.imageUrls,
              cardSet: item.cardSet ? {
                name: item.cardSet.name,
                series: {
                  category: { name: item.cardSet.series.category.name },
                },
              } : null,
              buyer: item.buyer,
            }))}
            isOwner={isOwner}
            isLive={false}
            hasSession={!!session?.user}
          />
        )}
      </div>

      {/* Social share */}
      <div className="mt-4">
        <SocialShare title={claimsale.title} />
      </div>

      {/* Carousel */}
      <ItemCarousel
        title={tCarousel("otherItemsBySeller")}
        items={sellerItems}
      />
    </PageContainer>
  );
}
