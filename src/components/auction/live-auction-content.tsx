"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { BidSection } from "./bid-section";
import { AutoBidForm } from "./autobid-form";
import { CountdownTimer } from "./countdown-timer";
import { ContactSellerButton } from "@/components/message/contact-seller-button";
import { ArrowUp } from "lucide-react";

interface BidEntry {
  id: string;
  amount: number;
  bidderName: string;
  createdAt: string;
}

interface BidData {
  currentBid: number | null;
  startingBid: number;
  buyNowPrice: number | null;
  endTime: string;
  status: string;
  bidCount: number;
  highestBidderId: string | null;
  recentBids: BidEntry[];
}

interface LiveAuctionContentProps {
  auctionId: string;
  sellerId: string;
  currentUserId: string | null;
  isOwner: boolean;
  initialCurrentBid: number | null;
  startingBid: number;
  buyNowPrice: number | null;
  endTime: string;
  status: string;
  reservePrice: number | null;
  initialBids: BidEntry[];
  initialBidCount: number;
  initialHighestBidderId: string | null;
  existingAutoBid: { maxAmount: number; isActive: boolean } | null;
  availableBalance: number;
}

export function LiveAuctionContent({
  auctionId,
  sellerId,
  currentUserId,
  isOwner,
  initialCurrentBid,
  startingBid,
  buyNowPrice,
  endTime,
  status,
  reservePrice,
  initialBids,
  initialBidCount,
  initialHighestBidderId,
  existingAutoBid,
  availableBalance,
}: LiveAuctionContentProps) {
  const t = useTranslations("auction");

  const [bidData, setBidData] = useState<BidData>({
    currentBid: initialCurrentBid,
    startingBid,
    buyNowPrice,
    endTime,
    status,
    bidCount: initialBidCount,
    highestBidderId: initialHighestBidderId,
    recentBids: initialBids,
  });
  const [hasNewBid, setHasNewBid] = useState(false);
  const [showArrow, setShowArrow] = useState(false);
  const [lastBidId, setLastBidId] = useState(initialBids[0]?.id ?? null);
  const prevBidRef = useRef(initialCurrentBid ?? startingBid);
  // Track whether the user was ever the highest bidder (to detect being outbid)
  const wasHighestBidderRef = useRef(initialHighestBidderId === currentUserId);

  const isHighestBidder =
    currentUserId !== null && bidData.highestBidderId === currentUserId;
  const isActive =
    bidData.status === "ACTIVE" && new Date(bidData.endTime) > new Date();

  // Update the ref when isHighestBidder changes
  useEffect(() => {
    if (isHighestBidder) {
      wasHighestBidderRef.current = true;
    }
  }, [isHighestBidder]);

  const fetchBids = useCallback(async () => {
    try {
      const res = await fetch(`/api/auctions/${auctionId}/bids`);
      if (!res.ok) return;
      const data: BidData = await res.json();

      const newTopBid = data.recentBids[0]?.id;
      if (newTopBid && newTopBid !== lastBidId) {
        setHasNewBid(true);
        setLastBidId(newTopBid);

        // Green arrow animation when bid goes up
        const newAmount = data.currentBid ?? data.startingBid;
        if (newAmount > prevBidRef.current) {
          setShowArrow(true);
          setTimeout(() => setShowArrow(false), 1500);
        }
        prevBidRef.current = newAmount;

        setTimeout(() => setHasNewBid(false), 2000);
      }

      setBidData(data);
    } catch {
      // Silent fail - will retry next interval
    }
  }, [auctionId, lastBidId]);

  useEffect(() => {
    if (bidData.status !== "ACTIVE") return;

    const getInterval = () => {
      const timeLeft = new Date(bidData.endTime).getTime() - Date.now();
      return timeLeft <= 30 * 60 * 1000 ? 2000 : 5000;
    };

    let timeoutId: NodeJS.Timeout;
    const poll = () => {
      fetchBids();
      timeoutId = setTimeout(poll, getInterval());
    };
    timeoutId = setTimeout(poll, getInterval());

    return () => clearTimeout(timeoutId);
  }, [bidData.status, bidData.endTime, fetchBids]);

  // Determine if user has been outbid (was highest bidder, now isn't)
  const showOutbidWarning =
    isActive &&
    !isOwner &&
    currentUserId !== null &&
    !isHighestBidder &&
    wasHighestBidderRef.current;

  return (
    <>
      {/* Sidebar */}
      <div className="space-y-4">
        <div
          className={`glass rounded-2xl p-6 transition-all duration-300 ${
            hasNewBid ? "ring-2 ring-primary/50" : ""
          }`}
        >
          {/* Current bid with arrow animation */}
          <div className="text-center relative">
            <p className="text-sm text-muted-foreground">{t("currentBid")}</p>
            <div className="relative inline-block mt-1">
              {/* Green arrow animation */}
              {showArrow && (
                <div
                  className="absolute -left-8 top-1/2"
                  style={{
                    animation: "bidArrowUp 1.5s ease-out forwards",
                  }}
                >
                  <ArrowUp className="h-6 w-6 text-green-500" />
                </div>
              )}
              <p
                className={`text-3xl font-bold transition-all duration-500 ${
                  showArrow
                    ? "text-green-500 scale-110"
                    : hasNewBid
                      ? "text-primary scale-105"
                      : "text-foreground scale-100"
                }`}
              >
                {"\u20AC"}
                {(bidData.currentBid ?? bidData.startingBid).toFixed(2)}
              </p>
            </div>
            {bidData.currentBid === null && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("startingBid")}
              </p>
            )}
            {bidData.bidCount > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {bidData.bidCount}{" "}
                {bidData.bidCount === 1 ? "bod" : "biedingen"}
              </p>
            )}
          </div>

          {/* Reserve status */}
          {reservePrice !== null && (
            <div className="mt-3 text-center">
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  (bidData.currentBid ?? 0) >= reservePrice
                    ? "bg-success-light text-success dark:bg-green-950 dark:text-green-400"
                    : "bg-warning-light text-warning dark:bg-yellow-950 dark:text-yellow-400"
                }`}
              >
                {(bidData.currentBid ?? 0) >= reservePrice
                  ? t("reserveMet")
                  : t("reserveNotMet")}
              </span>
            </div>
          )}

          {/* Timer */}
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">{t("timeLeft")}</p>
            <CountdownTimer endTime={bidData.endTime} />
          </div>

          {/* Highest bidder banner */}
          {isActive && !isOwner && currentUserId && isHighestBidder && (
            <div className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-center text-sm font-medium text-green-700 dark:bg-green-950/30 dark:text-green-400">
              {t("youAreHighestBidder")}
            </div>
          )}

          {/* Outbid warning - only shows when user WAS highest bidder and now isn't */}
          {showOutbidWarning && (
            <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-700 dark:bg-red-950/30 dark:text-red-400">
              {t("youAreOutbid")}
            </div>
          )}

          {/* Bid form */}
          {isActive && !isOwner && currentUserId && (
            <div className="mt-6 space-y-4">
              <BidSection
                auctionId={auctionId}
                currentBid={bidData.currentBid}
                startingBid={bidData.startingBid}
                buyNowPrice={bidData.buyNowPrice}
                isHighestBidder={isHighestBidder}
                availableBalance={availableBalance}
              />
              <AutoBidForm
                auctionId={auctionId}
                currentBid={bidData.currentBid}
                startingBid={bidData.startingBid}
                existingAutoBid={existingAutoBid}
              />
            </div>
          )}

          {!currentUserId && isActive && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              {t("loginToBid")}
            </p>
          )}

          {!isOwner && currentUserId && (
            <div className="mt-4">
              <ContactSellerButton
                sellerId={sellerId}
                auctionId={auctionId}
              />
            </div>
          )}

          {bidData.status !== "ACTIVE" && (
            <div className="mt-4 text-center">
              <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
                {t("ended")} — {bidData.status}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bid history */}
      <div className="lg:col-span-2">
        <h2 className="text-lg font-semibold text-foreground">
          {t("bidHistory")}
        </h2>
        {bidData.recentBids.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("noBids")}</p>
        ) : (
          <div className="mt-3 space-y-2">
            {bidData.recentBids.map((bid, i) => (
              <div
                key={bid.id}
                className={`flex items-center justify-between rounded-xl px-4 py-3 transition-all duration-300 ${
                  i === 0
                    ? `glass bg-primary-light/50 dark:bg-primary/10 ${
                        hasNewBid ? "ring-2 ring-primary/30" : ""
                      }`
                    : "glass-subtle"
                }`}
              >
                <span className="text-sm font-medium text-foreground">
                  {bid.bidderName}
                </span>
                <div className="text-right">
                  <span
                    className={`font-semibold ${
                      i === 0 ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {"\u20AC"}
                    {bid.amount.toFixed(2)}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {new Date(bid.createdAt).toLocaleString("nl-NL")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </>
  );
}
