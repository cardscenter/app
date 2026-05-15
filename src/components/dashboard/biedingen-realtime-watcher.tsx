"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useRealtime } from "@/components/providers/realtime-provider";

/** Houdt /dashboard/biedingen synchroon. Registreert per live-auction de
 *  `auction:<id>`-channel zodat externe bid-placed events (van andere bidders)
 *  binnenkomen. Subscribet daarnaast op user-channel events die de splitsing
 *  raken (outbid, auction-won, auction-ended). Elk relevant event triggert
 *  router.refresh() — server-side data-fetch herrekent dan live vs past. */
export function BiedingenRealtimeWatcher({ liveAuctionIds }: { liveAuctionIds: string[] }) {
  const router = useRouter();
  const { subscribe, registerChannels } = useRealtime();

  const channels = useMemo(
    () => liveAuctionIds.map((id) => `auction:${id}`),
    [liveAuctionIds],
  );

  useEffect(() => {
    if (channels.length === 0) return;
    return registerChannels(channels);
  }, [registerChannels, channels]);

  useEffect(() => {
    const types = ["bid-placed", "outbid", "auction-ended", "auction-won", "balance-changed"] as const;
    const offs = types.map((t) => subscribe(t, () => router.refresh()));
    return () => {
      for (const off of offs) off();
    };
  }, [subscribe, router]);

  return null;
}
