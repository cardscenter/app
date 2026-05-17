import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { SellerAuctionCard, type SellerAuctionCardData } from "@/components/dashboard/seller-auction-card";
import { EndedAuctionRow } from "@/components/dashboard/ended-auction-row";
import { VeilingenRealtimeWatcher } from "@/components/dashboard/veilingen-realtime-watcher";

const LIVE_STATUSES = new Set(["ACTIVE", "SCHEDULED"]);

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
    select: {
      id: true,
      title: true,
      description: true,
      imageUrls: true,
      status: true,
      startingBid: true,
      currentBid: true,
      reservePrice: true,
      buyNowPrice: true,
      finalPrice: true,
      startTime: true,
      endTime: true,
      deliveryMethod: true,
      pickupCity: true,
      _count: { select: { bids: true } },
      bids: {
        orderBy: { amount: "desc" },
        take: 1,
        select: {
          amount: true,
          bidder: { select: { id: true, displayName: true, avatarUrl: true } },
        },
      },
      labels: { select: { type: true, colorKey: true } },
    },
  });

  // Split: lopend vs. afgelopen. "Lopend" = ACTIVE + SCHEDULED (laatste is nog
  // niet gestart maar mag al worden bewerkt — daarom hoort 'ie boven).
  const liveAuctions: SellerAuctionCardData[] = auctions
    .filter((a) => LIVE_STATUSES.has(a.status))
    .map((a) => {
      const bidCount = a._count.bids;
      const topBid = a.bids[0];
      const hasReserveMet =
        a.reservePrice === null || a.reservePrice === 0
          ? true
          : (a.currentBid ?? 0) >= a.reservePrice;
      return {
        id: a.id,
        title: a.title,
        imageUrls: a.imageUrls,
        status: a.status as "ACTIVE" | "SCHEDULED",
        startingBid: a.startingBid,
        currentBid: a.currentBid,
        reservePrice: a.reservePrice,
        buyNowPrice: a.buyNowPrice,
        startTime: a.startTime,
        endTime: a.endTime,
        bidCount,
        topBidder: topBid
          ? {
              id: topBid.bidder.id,
              displayName: topBid.bidder.displayName,
              avatarUrl: topBid.bidder.avatarUrl,
              amount: topBid.amount,
            }
          : null,
        hasReserveMet,
        labels: a.labels.map((l) => ({ type: l.type, colorKey: l.colorKey })),
        editData: {
          title: a.title,
          description: a.description,
          imageUrls: a.imageUrls,
          startingBid: a.startingBid,
          reservePrice: a.reservePrice,
          buyNowPrice: a.buyNowPrice,
          pickupCity: a.pickupCity,
          deliveryMethod: (a.deliveryMethod as "SHIP" | "PICKUP" | "BOTH") ?? "SHIP",
          startTime: a.startTime,
          endTime: a.endTime,
        },
      };
    });

  // "Hot first" sort: veilingen met ≥5 biedingen vooraan zodat de verkoper
  // direct ziet wat momentum heeft. Daarna oplopend bod, daarna no-bids
  // (waar promotie nuttig kan zijn), daarna SCHEDULED achteraan. Tie-break op
  // eindtijd-asc zodat dichtstbijzijnde afloop bovenaan binnen elke groep.
  liveAuctions.sort((a, b) => {
    const score = (c: SellerAuctionCardData) => {
      if (c.status === "ACTIVE" && c.bidCount >= 5) return 0;
      if (c.status === "ACTIVE" && c.bidCount > 0) return 1;
      if (c.status === "ACTIVE" && c.bidCount === 0) return 2;
      return 3; // SCHEDULED
    };
    const sa = score(a);
    const sb = score(b);
    if (sa !== sb) return sa - sb;
    return a.endTime.getTime() - b.endTime.getTime();
  });

  const endedAuctions = auctions.filter((a) => !LIVE_STATUSES.has(a.status));

  return (
    <div className="space-y-8">
      <VeilingenRealtimeWatcher liveAuctionIds={liveAuctions.map((a) => a.id)} />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("myAuctions")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Volg, beheer en pas je actieve en geplande veilingen aan.
          </p>
        </div>
        <Link
          href="/veilingen/nieuw"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          + {ta("createTitle")}
        </Link>
      </header>

      {/* LIVE-sectie */}
      <section>
        <div className="mb-3">
          <h2 className="flex items-center gap-2.5 text-lg font-semibold text-foreground">
            <span className="relative inline-flex h-2.5 w-2.5 shrink-0">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75"
                aria-hidden="true"
              />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
            </span>
            Live veilingen
            {liveAuctions.length > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {liveAuctions.length}
              </span>
            )}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Actieve en geplande veilingen — bewerk waar mogelijk en zie biedingen binnenkomen.
          </p>
        </div>
        {liveAuctions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
            {t("noActiveAuctions")}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {liveAuctions.map((a) => (
              <SellerAuctionCard key={a.id} auction={a} />
            ))}
          </div>
        )}
      </section>

      {/* AFGELOPEN-sectie */}
      <section>
        <div className="mb-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Clock className="h-5 w-5 text-muted-foreground" />
            Afgelopen veilingen
            {endedAuctions.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {endedAuctions.length}
              </span>
            )}
          </h2>
        </div>
        {endedAuctions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
            Nog geen afgelopen veilingen.
          </div>
        ) : (
          <div className="space-y-2">
            {endedAuctions.map((a) => (
              <EndedAuctionRow
                key={a.id}
                auction={{
                  id: a.id,
                  title: a.title,
                  imageUrls: a.imageUrls,
                  status: a.status,
                  finalPrice: a.finalPrice,
                  currentBid: a.currentBid,
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
