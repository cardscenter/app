import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function BiedingenPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const t = await getTranslations("bids");

  // Get all auctions the user has bid on
  const bids = await prisma.auctionBid.findMany({
    where: { bidderId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      auction: {
        select: {
          id: true,
          title: true,
          currentBid: true,
          endTime: true,
          status: true,
          winnerId: true,
        },
      },
    },
  });

  // Group by auction, show only highest bid per auction
  const auctionMap = new Map<string, typeof bids[0]>();
  for (const bid of bids) {
    if (!auctionMap.has(bid.auctionId)) {
      auctionMap.set(bid.auctionId, bid);
    }
  }
  const uniqueBids = Array.from(auctionMap.values());

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>

      {uniqueBids.length === 0 ? (
        <div className="glass-subtle rounded-2xl p-8 text-center text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <div className="space-y-3">
          {uniqueBids.map((bid) => {
            const isHighest = bid.amount === bid.auction.currentBid;
            const isWinner = bid.auction.winnerId === session.user!.id;
            const isActive = bid.auction.status === "ACTIVE";
            const isEnded = bid.auction.status !== "ACTIVE";

            return (
              <Link
                key={bid.id}
                href={`/${locale}/veilingen/${bid.auctionId}`}
                className="glass-subtle flex items-center justify-between rounded-2xl p-4 transition-all hover:scale-[1.005] hover:shadow-md"
              >
                <div>
                  <h3 className="font-medium text-foreground">{bid.auction.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("yourBid")}: €{bid.amount.toFixed(2)}
                    {isActive && bid.auction.currentBid && (
                      <> · {t("currentBid")}: €{bid.auction.currentBid.toFixed(2)}</>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  {isWinner && (
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      {t("won")}
                    </span>
                  )}
                  {isActive && isHighest && !isWinner && (
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {t("highest")}
                    </span>
                  )}
                  {isActive && !isHighest && (
                    <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                      {t("outbid")}
                    </span>
                  )}
                  {isEnded && !isWinner && (
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {t("ended")}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
