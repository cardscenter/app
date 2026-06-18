"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";

export interface MapEvent {
  id: string;
  title: string;
  lat: number;
  lng: number;
  city: string;
  startTime: string;
}

// Custom div-icon pin — vermijdt het bekende Leaflet-marker-asset-pad-probleem
// in bundlers (geen png-imports nodig) en houdt één consistente icoonstijl.
const pinIcon = L.divIcon({
  className: "",
  html: `<svg viewBox="0 0 24 24" width="24" height="24" fill="#6366f1" stroke="#ffffff" stroke-width="1.5">
    <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z"/>
    <circle cx="12" cy="9" r="2.5" fill="#ffffff" stroke="none"/>
  </svg>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -22],
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Imperatieve clustering-laag: react-leaflet-cluster ondersteunt react-leaflet
// v5 nog niet betrouwbaar, dus we hangen de leaflet.markercluster-plugin direct
// aan de map via useMap(). Nabijgelegen events groeperen tot een genummerde
// bubbel; inzoomen splitst ze uit.
function ClusterLayer({ events, locale }: { events: MapEvent[]; locale: string }) {
  const map = useMap();

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const group = (L as any).markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 60,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:9999px;background:#6366f1;color:#fff;font-weight:700;font-size:14px;border:3px solid rgba(255,255,255,0.9);box-shadow:0 1px 4px rgba(0,0,0,0.35)">${count}</div>`,
          className: "",
          iconSize: L.point(40, 40, true),
        });
      },
    });

    for (const e of events) {
      const dateStr = new Date(e.startTime).toLocaleDateString("nl-NL", {
        day: "numeric",
        month: "long",
      });
      const marker = L.marker([e.lat, e.lng], { icon: pinIcon });
      marker.bindPopup(
        `<div style="min-width:160px">
          <p style="font-weight:600;margin:0 0 2px">${escapeHtml(e.title)}</p>
          <p style="color:#64748b;margin:0 0 6px;font-size:12px">${escapeHtml(e.city)} · ${dateStr}</p>
          <a href="/${locale}/evenementen/${e.id}" style="color:#4f46e5;text-decoration:underline;font-size:13px">Bekijk details</a>
        </div>`,
      );
      group.addLayer(marker);
    }

    map.addLayer(group);

    if (events.length === 1) {
      map.setView([events[0].lat, events[0].lng], 11);
    } else if (events.length > 1) {
      map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 12 });
    }

    return () => {
      map.removeLayer(group);
    };
  }, [events, locale, map]);

  return null;
}

export default function LeafletMap({
  events,
  locale,
}: {
  events: MapEvent[];
  locale: string;
}) {
  return (
    <MapContainer
      center={[50.5, 9]}
      zoom={4}
      scrollWheelZoom
      className="h-[600px] w-full rounded-xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-bijdragers'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClusterLayer events={events} locale={locale} />
    </MapContainer>
  );
}
