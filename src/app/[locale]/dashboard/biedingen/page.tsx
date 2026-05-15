import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { Clock } from "lucide-react";
import { ActiveRunnerUpOffersSection } from "@/components/dashboard/active-runner-up-offers-section";
import { LiveBidCard, type LiveBidCardData } from "@/components/dashboard/live-bid-card";
import { PastBidRow, type PastBidStatus } from "@/components/dashboard/past-bid-row";
import { BiedingenRealtimeWatcher } from "@/components/dashboard/biedingen-realtime-watcher";
import { getReserveBreakdown } from "@/lib/balance-check";

interface AuctionContext {
  id: string;
  title: string;
  imageUrls: string | null;
  status: string;
  startingBid: number;
  currentBid: number | null;
  finalPrice: number | null;
  endTime: Date;
  winnerId: string | null;
  deliveryMethod: string;
  topBidderId: string | null;
}

export default async function LiveHubPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);
  const userId = session.user.id;

  const t = await getTranslations("bids");

  // 1. Twee bronnen die Live Hub vullen:
  //    a) Watchlist — auctions die user expliciet via hartje volgt
  //    b) Bid-history — auctions waar user op heeft geboden (ook ENDED)
  const [watchedRows, bidRows] = await Promise.all([
    prisma.watchlist.findMany({
      where: { userId, auctionId: { not: null } },
      select: { auctionId: true },
    }),
    prisma.auctionBid.findMany({
      where: { bidderId: userId },
      select: { auctionId: true, amount: true },
      orderBy: { amount: "desc" },
    }),
  ]);

  // Map: auctionId → user's hoogste bod (null = nooit geboden, alleen gevolgd)
  const userHighestByAuction = new Map<string, number>();
  for (const b of bidRows) {
    if (!userHighestByAuction.has(b.auctionId)) {
      userHighestByAuction.set(b.auctionId, b.amount);
    }
  }

  // Volledige auction-set: union van watched + bid-on
  const allAuctionIds = new Set<string>();
  for (const w of watchedRows) if (w.auctionId) allAuctionIds.add(w.auctionId);
  for (const id of userHighestByAuction.keys()) allAuctionIds.add(id);

  if (allAuctionIds.size === 0) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </header>
        <ActiveRunnerUpOffersSection />
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center text-muted-foreground">
          {t("empty")}
        </div>
      </div>
    );
  }

  const auctionIds = Array.from(allAuctionIds);
  const watchedSet = new Set(watchedRows.map((w) => w.auctionId).filter((id): id is string => !!id));

  // 2. Fetch alle auctions met top-bid (om isHighestBidder te bepalen)
  const auctions = await prisma.auction.findMany({
    where: { id: { in: auctionIds } },
    select: {
      id: true,
      title: true,
      imageUrls: true,
      status: true,
      startingBid: true,
      currentBid: true,
      finalPrice: true,
      endTime: true,
      winnerId: true,
      deliveryMethod: true,
      bids: { orderBy: { amount: "desc" }, take: 1, select: { bidderId: true } },
    },
    orderBy: { endTime: "asc" },
  });

  const enriched: AuctionContext[] = auctions.map((a) => ({
    id: a.id,
    title: a.title,
    imageUrls: a.imageUrls,
    status: a.status,
    startingBid: a.startingBid,
    currentBid: a.currentBid,
    finalPrice: a.finalPrice,
    endTime: a.endTime,
    winnerId: a.winnerId,
    deliveryMethod: a.deliveryMethod,
    topBidderId: a.bids[0]?.bidderId ?? null,
  }));

  // 3. Active autobids (Map)
  const autoBids = await prisma.autoBid.findMany({
    where: { userId, isActive: true, auctionId: { in: auctionIds } },
    select: { auctionId: true, maxAmount: true },
  });
  const autoBidByAuction = new Map<string, number>();
  for (const ab of autoBids) autoBidByAuction.set(ab.auctionId, ab.maxAmount);

  // 4. Reserve per auction
  const breakdown = await getReserveBreakdown(userId);
  const reserveByAuction = new Map<string, number>();
  for (const r of breakdown.rows) reserveByAuction.set(r.auctionId, r.reserveAmount);

  // 5. Split:
  //    LIVE   = ACTIVE-auctions (= status ACTIVE of SCHEDULED) — gevolgd OF gebod
  //    PAST   = niet-ACTIVE auctions waar user op heeft geboden (gevolgd-only-
  //             en-geëindigd valt er ook in zodat user de uitslag ziet)
  const liveCards: LiveBidCardData[] = [];
  const pastRows: Array<{ auction: AuctionContext; yourBid: number; outcome: PastBidStatus; wasBidder: boolean }> = [];

  for (const a of enriched) {
    const yourBid = userHighestByAuction.get(a.id) ?? 0;
    const hasBid = yourBid > 0;
    const autoMax = autoBidByAuction.get(a.id) ?? null;
    const isHighest = a.topBidderId === userId;

    if (a.status === "ACTIVE") {
      liveCards.push({
        id: a.id,
        title: a.title,
        imageUrls: a.imageUrls,
        currentBid: a.currentBid,
        startingBid: a.startingBid,
        endTime: a.endTime,
        deliveryMethod: a.deliveryMethod as "SHIP" | "PICKUP" | "BOTH",
        yourBid,
        autoBidMax: autoMax,
        isHighestBidder: isHighest,
        reserveAmount: reserveByAuction.get(a.id) ?? 0,
        isTracked: watchedSet.has(a.id),
      });
    } else {
      // ENDED: alleen tonen in past-sectie als user heeft gebod, anders is het
      // ruis (gewoon "veiling afgelopen waar niemand iets mee deed").
      if (!hasBid) continue;
      const outcome: PastBidStatus = a.winnerId === userId ? "WON" : "LOST";
      pastRows.push({ auction: a, yourBid, outcome, wasBidder: true });
    }
  }

  // Live sortering: hoogste-bieder bovenaan, daarna overboden-met-autobid, dan
  // gevolgde-zonder-bod, dan snelst-eindigende binnen elke groep.
  liveCards.sort((a, b) => {
    const score = (c: LiveBidCardData) =>
      c.isHighestBidder ? 0 : c.autoBidMax !== null ? 1 : c.yourBid > 0 ? 2 : 3;
    const sa = score(a);
    const sb = score(b);
    if (sa !== sb) return sa - sb;
    return a.endTime.getTime() - b.endTime.getTime();
  });

  return (
    <div className="space-y-8">
      <BiedingenRealtimeWatcher liveAuctionIds={liveCards.map((c) => c.id)} />

      <header>
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <ActiveRunnerUpOffersSection />

      {/* LIVE-sectie — 2 cards naast elkaar op desktop */}
      <section>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2.5 text-lg font-semibold text-foreground">
              {/* Pulserend "Live"-bolletje — outer ring ping't, inner solid blijft staan.
                  Universele streaming-signaal die mensen meteen herkennen. */}
              <span className="relative inline-flex h-2.5 w-2.5 shrink-0">
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75"
                  aria-hidden="true"
                />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
              </span>
              {t("liveTitle")}
              {liveCards.length > 0 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {liveCards.length}
                </span>
              )}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{t("liveDescription")}</p>
          </div>
        </div>
        {liveCards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
            {t("liveEmpty")}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {liveCards.map((c) => (
              <LiveBidCard key={c.id} auction={c} />
            ))}
          </div>
        )}
      </section>

      {/* PAST-sectie */}
      <section>
        <div className="mb-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Clock className="h-5 w-5 text-muted-foreground" />
            {t("pastTitle")}
            {pastRows.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {pastRows.length}
              </span>
            )}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("pastDescription")}</p>
        </div>
        {pastRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
            {t("pastEmpty")}
          </div>
        ) : (
          <div className="space-y-2">
            {pastRows.map((row) => (
              <PastBidRow key={row.auction.id} auction={row.auction} yourBid={row.yourBid} outcome={row.outcome} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
