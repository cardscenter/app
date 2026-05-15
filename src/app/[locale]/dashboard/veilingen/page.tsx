import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import { AuctionOwnerActions } from "@/components/auction/auction-owner-actions";

export default async function MyAuctionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const t = await getTranslations("dashboard");
  const ta = await getTranslations("auction");

  const auctions = await prisma.auction.findMany({
    where: { sellerId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { bids: true } } },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          {t("myAuctions")}
        </h1>
        <Link
          href="/veilingen/nieuw"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          + {ta("createTitle")}
        </Link>
      </div>

      {auctions.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          {t("noActiveAuctions")}
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {auctions.map((auction) => (
            <div
              key={auction.id}
              className="flex items-center gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
            >
              <Link href={`/veilingen/${auction.id}`} className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="truncate font-medium text-foreground">
                    {auction.title}
                  </h3>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    auction.status === "ACTIVE"
                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      : auction.status === "SCHEDULED"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                      : auction.status === "ENDED_SOLD" || auction.status === "BOUGHT_NOW"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {auction.status === "SCHEDULED" ? ta("auctionScheduledBadge") : auction.status}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>{ta("currentBid")}: €{(auction.currentBid ?? auction.startingBid).toFixed(2)}</span>
                  <span>{auction._count.bids} biedingen</span>
                  {auction.status === "SCHEDULED" && auction.startTime ? (
                    <span>{ta("startsAt")}: {new Date(auction.startTime).toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam", dateStyle: "short", timeStyle: "short" })}</span>
                  ) : (
                    <span>{new Date(auction.endTime).toLocaleDateString("nl-NL")}</span>
                  )}
                </div>
              </Link>
              {/* Owner-actie (Fase 27.88): annuleer-knop alleen voor ACTIVE
                  veilingen zonder biedingen. Component rendert null anders. */}
              <AuctionOwnerActions
                auctionId={auction.id}
                bidCount={auction._count.bids}
                status={auction.status}
                variant="card"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
