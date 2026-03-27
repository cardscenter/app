import { getTranslations } from "next-intl/server";
import { getSellerStats, getSellerReviews } from "@/actions/review";
import { auth } from "@/lib/auth";
import { SellerReputationCard } from "@/components/ui/seller-reputation-card";
import { ReviewList } from "@/components/ui/review-list";
import { ReviewForm } from "@/components/ui/review-form";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";

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
  const canReview = isLoggedIn && !isOwner;

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

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToHome")}
      </Link>

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

          {/* Review form */}
          {canReview && (
            <ReviewForm sellerId={userId} />
          )}
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
