"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRealtime } from "@/components/providers/realtime-provider";
import type { RealtimeEvent } from "@/lib/realtime";

/**
 * Fire-and-forget refresh-on-event component voor server-rendered layouts.
 * Drop in een server-component (bv. dashboard-layout) zodat een lijst
 * SSE-event-types een router.refresh() triggert op de hele tree —
 * de SSR re-render haalt verse data op zonder client-side state.
 */
export function RealtimePageRefresh({ events }: { events: RealtimeEvent["type"][] }) {
  const router = useRouter();
  const { subscribe } = useRealtime();

  useEffect(() => {
    const offs = events.map((type) => subscribe(type, () => router.refresh()));
    return () => {
      for (const off of offs) off();
    };
  }, [events, subscribe, router]);

  return null;
}
