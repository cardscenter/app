"use client";

import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import type { MapEvent } from "@/components/events/leaflet-map";

// Leaflet raakt `window` → client-only laden (ssr:false mag alleen in een
// Client Component, zie Next 16 lazy-loading docs).
const LeafletMap = dynamic(() => import("@/components/events/leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[600px] w-full items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
      Kaart laden…
    </div>
  ),
});

export function EventMap({ events }: { events: MapEvent[] }) {
  const withCoords = events.filter((e) => Number.isFinite(e.lat) && Number.isFinite(e.lng));

  if (withCoords.length === 0) {
    return (
      <div className="flex h-[600px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-border bg-muted text-muted-foreground">
        <MapPin className="h-8 w-8" />
        <p className="text-sm">Geen evenementen met een kaartlocatie gevonden.</p>
      </div>
    );
  }

  return <LeafletMap events={withCoords} />;
}
