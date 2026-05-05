"use client";

import { useEffect, useRef, useCallback } from "react";
import type { RealtimeEvent } from "@/lib/realtime";

type Listener = (event: RealtimeEvent) => void;

/**
 * Manages een single EventSource per browser-tab en levert een `subscribe`
 * functie die door consumer-componenten gebruikt wordt om listeners per
 * event-type te registreren.
 *
 * Auto-reconnect met exponential backoff. Caller geeft optioneel extra
 * auction-channels mee waarop deze tab moet luisteren.
 */
export function useRealtimeEvents(opts: { enabled: boolean; auctionChannels?: string[] }) {
  const { enabled, auctionChannels } = opts;
  const listenersRef = useRef<Map<RealtimeEvent["type"], Set<Listener>>>(new Map());
  const sourceRef = useRef<EventSource | null>(null);
  const retryDelayRef = useRef(1000);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const subscribe = useCallback((type: RealtimeEvent["type"], listener: Listener) => {
    let set = listenersRef.current.get(type);
    if (!set) {
      set = new Set();
      listenersRef.current.set(type, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    function connect() {
      const channels = auctionChannels?.length ? `?channels=${auctionChannels.join(",")}` : "";
      const url = `/api/events/stream${channels}`;
      const source = new EventSource(url);
      sourceRef.current = source;

      source.onopen = () => {
        retryDelayRef.current = 1000;
      };

      source.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as RealtimeEvent;
          const set = listenersRef.current.get(event.type);
          if (!set) return;
          for (const listener of set) {
            try {
              listener(event);
            } catch {
              // Een falende listener mag de andere niet blokkeren.
            }
          }
        } catch {
          // Malformed payload — negeren.
        }
      };

      source.onerror = () => {
        // Browser sluit de connectie automatisch. We re-creëren met backoff.
        source.close();
        sourceRef.current = null;
        const delay = Math.min(retryDelayRef.current, 30_000);
        reconnectTimerRef.current = setTimeout(() => {
          retryDelayRef.current = Math.min(retryDelayRef.current * 2, 30_000);
          connect();
        }, delay);
      };
    }

    connect();

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      sourceRef.current?.close();
      sourceRef.current = null;
    };
  }, [enabled, auctionChannels]);

  return { subscribe };
}
