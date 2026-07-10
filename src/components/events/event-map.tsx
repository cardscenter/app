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

export function EventMap({ events, locale }: { events: MapEvent[]; locale: string }) {
  const withCoords = events.filter((e) => Number.isFinite(e.lat) && Number.isFinite(e.lng));

  // Kaart altijd renderen — met 0 markers blijft Leaflet op het default
  // Europa-overzicht en tonen we een overlay-pill i.p.v. een lege placeholder.
  return (
    <div className="relative">
      <LeafletMap events={withCoords} locale={locale} />
      {withCoords.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-4 z-[500] flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-card">
            <MapPin className="h-4 w-4 text-muted-foreground" /> Geen evenementen gevonden — pas je filters aan
          </span>
        </div>
      )}
    </div>
  );
}
