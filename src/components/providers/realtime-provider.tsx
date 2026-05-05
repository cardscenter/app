"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import type { RealtimeEvent } from "@/lib/realtime";

type Subscribe = (type: RealtimeEvent["type"], listener: (event: RealtimeEvent) => void) => () => void;
type RegisterChannels = (channels: string[]) => () => void;

type Ctx = {
  subscribe: Subscribe;
  /**
   * Component op een resource-page (bv. /veilingen/[id]) registreert hier
   * de auction-channels die het wil ontvangen. Provider zorgt dat de SSE-
   * connection deze channels meeneemt in zijn `?channels=` query.
   */
  registerChannels: RegisterChannels;
};

const RealtimeContext = createContext<Ctx | null>(null);

export function RealtimeProvider({
  isAuthenticated,
  children,
}: {
  isAuthenticated: boolean;
  children: React.ReactNode;
}) {
  // Set van actieve auction-channels die geregistreerd zijn door consumers.
  // Wordt doorgegeven aan de hook zodat de SSE-URL ze meeneemt.
  const [activeChannels, setActiveChannels] = useState<string[]>([]);
  const refCounts = useMemo(() => new Map<string, number>(), []);

  const registerChannels = useCallback<RegisterChannels>(
    (channels) => {
      for (const ch of channels) {
        refCounts.set(ch, (refCounts.get(ch) ?? 0) + 1);
      }
      setActiveChannels(Array.from(refCounts.keys()));
      return () => {
        for (const ch of channels) {
          const next = (refCounts.get(ch) ?? 1) - 1;
          if (next <= 0) refCounts.delete(ch);
          else refCounts.set(ch, next);
        }
        setActiveChannels(Array.from(refCounts.keys()));
      };
    },
    [refCounts],
  );

  const { subscribe } = useRealtimeEvents({
    enabled: isAuthenticated,
    auctionChannels: activeChannels,
  });

  // Geen top-level toast-handlers (Fase 30A bell-UX) — alle attention-grabbing
  // notificaties lopen via <NotificationBell> en <MessageIcon>: shake-animatie
  // + auto-open popover bij nieuwe events. createNotification publishet
  // notification-created → bell pakt het op met titel/body uit de DB.

  const value = useMemo<Ctx>(() => ({ subscribe, registerChannels }), [subscribe, registerChannels]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): Ctx {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    // Gracieus omgaan met componenten die buiten de provider mounten (bv.
    // niet-ingelogde state). Returnt no-op-functies zodat callers geen
    // null-check hoeven.
    return {
      subscribe: () => () => {},
      registerChannels: () => () => {},
    };
  }
  return ctx;
}
