"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useRealtime } from "@/components/providers/realtime-provider";

/** Houdt /dashboard/veilingen (seller-view) synchroon. Registreert per live
 *  veiling de `auction:<id>`-channel zodat bid-placed van anderen direct
 *  binnenkomt, plus user-channel events (auction-ended/won/balance-changed/
 *  auction-updated) zodat status-veranderingen en eigen wijzigingen meteen
 *  refreshen. Geen `outbid` — seller bid niet op eigen veilingen. */
export function VeilingenRealtimeWatcher({ liveAuctionIds }: { liveAuctionIds: string[] }) {
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
    const types = ["bid-placed", "auction-ended", "auction-won", "balance-changed", "auction-updated"] as const;
    const offs = types.map((t) => subscribe(t, () => router.refresh()));
    return () => {
      for (const off of offs) off();
    };
  }, [subscribe, router]);

  return null;
}
