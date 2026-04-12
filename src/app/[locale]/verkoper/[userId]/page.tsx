import { getTranslations } from "next-intl/server";
import { getSellerStats, getSellerReviews } from "@/actions/review";
import { auth } from "@/lib/auth";
import { SellerReputationCard } from "@/components/ui/seller-reputation-card";
import { ReviewList } from "@/components/ui/review-list";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { getBannerUrl, SELLER_LEVELS } from "@/lib/seller-levels";
import { CosmeticBannerImage } from "@/components/customization/cosmetic-banner-image";
import Image from "next/image";

export default async function SellerProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const t = await getTranslations("reputation");
  const session = await auth();

  const stats = await getSellerStats(userId);
  if (!stats) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <p className="text-center text-muted-foreground">{t("sellerNotFound")}</p>
      </div>
    );
  }

  const reviews = await getSellerReviews(userId);
  const isOwner = session?.user?.id === userId;
  const isLoggedIn = !!session?.user?.id;

  const seller = await prisma.user.findUnique({
    where: { id: userId },
    select: { profileBanner: true, profileEmblem: true, profileBackground: true, avatarUrl: true, displayName: true },
  });

  // Resolve emblem asset path
  const emblemItem = seller?.profileEmblem
    ? await prisma.cosmeticItem.findUnique({
        where: { key: seller.profileEmblem },
        select: { assetPath: true },
      })
    : null;

  // Get seller's active listings for the sidebar
  const activeListings = await prisma.listing.findMany({
    where: { sellerId: userId, status: "ACTIVE" },
    take: 5,
    orderBy: { createdAt: "desc" },
  });

  const activeAuctions = await prisma.auction.findMany({
    where: { sellerId: userId, status: "ACTIVE" },
    take: 5,
    orderBy: { createdAt: "desc" },
  });

  const activeClaimsales = await prisma.claimsale.findMany({
    where: { sellerId: userId, status: "LIVE" },
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: { where: { status: "AVAILABLE" } } } } },
  });

  // Resolve background asset path
  const backgroundItem = seller?.profileBackground
    ? await prisma.cosmeticItem.findUnique({
        where: { key: seller.profileBackground },
        select: { assetPath: true },
      })
    : null;

  return (
    <div className="relative min-h-screen">
      {/* Profile background */}
      {backgroundItem?.assetPath && (
        <div className="pointer-events-none fixed inset-0 -z-10">
          <Image
            src={backgroundItem.assetPath}
            alt="Profile background"
            fill
            className="object-cover opacity-60 dark:opacity-40"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background" />
        </div>
      )}

      <div className="container mx-auto max-w-7xl px-4 py-8">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToHome")}
      </Link>

      {/* Profile banner */}
      {seller?.profileBanner && (() => {
        const isLevelBanner = SELLER_LEVELS.some((l) => l.nameKey === seller.profileBanner);
        const bannerSrc = isLevelBanner
          ? getBannerUrl(seller.profileBanner!)
          : null;
        return (
          <div className="relative mb-6 aspect-[21/9] w-full overflow-hidden rounded-2xl">
            {bannerSrc ? (
              <Image
                src={bannerSrc}
                alt="Profile banner"
                fill
                className="object-cover"
                sizes="(max-width: 1280px) 100vw, 1280px"
                priority
              />
            ) : (
              <CosmeticBannerImage bannerKey={seller.profileBanner!} />
            )}

            {/* Emblem + avatar overlay */}
            {emblemItem?.assetPath && (
              <div className="absolute bottom-4 left-4 z-10 h-24 w-40 sm:bottom-12 sm:left-12 sm:h-40 sm:w-72">
                {/* Avatar clipped into the emblem circle */}
                <div className="absolute left-[8%] top-[16%] flex h-[68%] w-[37%] items-center justify-center overflow-hidden rounded-full">
                  {seller.avatarUrl ? (
                    <Image
                      src={seller.avatarUrl}
                      alt={seller.displayName ?? ""}
                      fill
                      className="object-cover"
                      sizes="120px"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-primary/20 text-lg font-bold text-primary sm:text-2xl">
                      {seller.displayName?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                {/* Emblem frame on top */}
                <Image
                  src={emblemItem.assetPath}
                  alt="Emblem"
                  fill
                  className="pointer-events-none object-contain drop-shadow-lg"
                  sizes="220px"
                />
              </div>
            )}
          </div>
        );
      })()}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          <SellerReputationCard stats={stats} />

          {/* XP Breakdown */}
          <div className="glass rounded-2xl p-6">
            <h3 className="mb-4 text-lg font-bold text-foreground">{t("xpBreakdown")}</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <XPItem label={t("xpAccountAge")} value={stats.xpBreakdown.accountAge} />
              <XPItem label={t("xpSales")} value={stats.xpBreakdown.sales} />
              <XPItem label={t("xpPurchases")} value={stats.xpBreakdown.purchases} />
              <XPItem label={t("xpReviews")} value={stats.xpBreakdown.positiveReviews} />
            </div>
          </div>

          {/* Reviews section */}
          <div className="glass rounded-2xl p-6">
            <h3 className="mb-4 text-lg font-bold text-foreground">
              {t("reviews")} ({reviews.length})
            </h3>
            <ReviewList reviews={reviews} isOwner={isOwner} />
          </div>

        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {activeAuctions.length > 0 && (
            <div className="glass rounded-2xl p-5">
              <h3 className="mb-3 font-semibold text-foreground">{t("activeAuctions")}</h3>
              <div className="space-y-2">
                {activeAuctions.map((auction) => (
                  <Link
                    key={auction.id}
                    href={`/veilingen/${auction.id}`}
                    className="block rounded-xl p-2.5 text-sm text-foreground transition-colors hover:bg-white/50 dark:hover:bg-white/5"
                  >
                    <span className="font-medium">{auction.title}</span>
                    {auction.currentBid && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        €{auction.currentBid.toFixed(2)}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {activeListings.length > 0 && (
            <div className="glass rounded-2xl p-5">
              <h3 className="mb-3 font-semibold text-foreground">{t("activeListings")}</h3>
              <div className="space-y-2">
                {activeListings.map((listing) => (
                  <Link
                    key={listing.id}
                    href={`/marktplaats/${listing.id}`}
                    className="block rounded-xl p-2.5 text-sm text-foreground transition-colors hover:bg-white/50 dark:hover:bg-white/5"
                  >
                    <span className="font-medium">{listing.title}</span>
                    {listing.price && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        €{listing.price.toFixed(2)}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {activeClaimsales.length > 0 && (
            <div className="glass rounded-2xl p-5">
              <h3 className="mb-3 font-semibold text-foreground">{t("activeClaimsales")}</h3>
              <div className="space-y-2">
                {activeClaimsales.map((cs) => (
                  <Link
                    key={cs.id}
                    href={`/claimsales/${cs.id}`}
                    className="block rounded-xl p-2.5 text-sm text-foreground transition-colors hover:bg-white/50 dark:hover:bg-white/5"
                  >
                    <span className="font-medium">{cs.title}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {cs._count.items} {t("availableItems")}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

function XPItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-subtle rounded-lg p-3 text-center">
      <span className="text-lg font-bold text-primary">{value}</span>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
