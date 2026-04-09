import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSellerStats, getSellerReviews } from "@/actions/review";
import { SellerReputationCard } from "@/components/ui/seller-reputation-card";
import { ReviewList } from "@/components/ui/review-list";

export default async function DashboardReviewsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations("reputation");
  const tCommon = await getTranslations("common");
  const stats = await getSellerStats(session.user.id);
  const reviews = await getSellerReviews(session.user.id);

  if (!stats) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        {tCommon("error")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t("reviews")}</h1>

      <SellerReputationCard stats={stats} />

      {/* Reviews received */}
      <div className="glass rounded-2xl p-6">
        <h3 className="mb-4 text-lg font-bold text-foreground">
          {t("reviewsReceived")} ({reviews.length})
        </h3>
        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noReviews")}</p>
        ) : (
          <ReviewList reviews={reviews} isOwner />
        )}
      </div>
    </div>
  );
}
