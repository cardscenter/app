"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeEvent } from "@/lib/realtime";
import { useRealtime } from "@/components/providers/realtime-provider";

/**
 * Subscribe op één of meer SSE-event-types en triggert router.refresh()
 * zodra een gematched event binnenkomt. Optioneel filter per event om
 * alleen op specifieke payload-waarden te refreshen.
 *
 * Gebruik op pages waar de visible state SSR-gerendered is (bv.
 * /aankopen, /verkopen, dispute-detail) — refresh haalt verse data op
 * zonder client-side state-management.
 */
export function useRefreshOnRealtime(
  types: RealtimeEvent["type"][],
  filter?: (event: RealtimeEvent) => boolean,
) {
  const router = useRouter();
  const { subscribe } = useRealtime();

  useEffect(() => {
    const offs = types.map((type) =>
      subscribe(type, (event) => {
        if (filter && !filter(event)) return;
        router.refresh();
      }),
    );
    return () => {
      for (const off of offs) off();
    };
  }, [types, filter, subscribe, router]);
}
