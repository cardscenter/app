"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useRealtime } from "@/components/providers/realtime-provider";

/**
 * Render-it-once-on-listing-detail-page: registers de listing-channel +
 * triggert router.refresh() bij listing-changed events. Server-side
 * publishers in pauseListing/resumeListing/buyListing/etc. doen de rest.
 */
export function ListingRealtimeWatcher({ listingId }: { listingId: string }) {
  const router = useRouter();
  const { subscribe, registerChannels } = useRealtime();
  const channels = useMemo(() => [`listing:${listingId}`], [listingId]);

  useEffect(() => registerChannels(channels), [registerChannels, channels]);

  useEffect(() => {
    return subscribe("listing-changed", (event) => {
      if (event.type !== "listing-changed") return;
      if (event.payload.listingId !== listingId) return;
      router.refresh();
    });
  }, [subscribe, listingId, router]);

  return null;
}
