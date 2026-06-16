"use client";

import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "@/i18n/navigation";

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
  html: `<div style="width:24px;height:24px;transform:translate(-50%,-100%);">
    <svg viewBox="0 0 24 24" width="24" height="24" fill="#6366f1" stroke="#ffffff" stroke-width="1.5">
      <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z"/>
      <circle cx="12" cy="9" r="2.5" fill="#ffffff" stroke="none"/>
    </svg>
  </div>`,
  iconSize: [24, 24],
  iconAnchor: [0, 0],
});

function FitBounds({ events }: { events: MapEvent[] }) {
  const map = useMap();
  useMemo(() => {
    if (events.length === 0) return;
    if (events.length === 1) {
      map.setView([events[0].lat, events[0].lng], 11);
      return;
    }
    const bounds = L.latLngBounds(events.map((e) => [e.lat, e.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
  }, [events, map]);
  return null;
}

export default function LeafletMap({ events }: { events: MapEvent[] }) {
  // Centrum van Europa als fallback wanneer er geen events met coördinaten zijn.
  const center: [number, number] = events.length > 0 ? [events[0].lat, events[0].lng] : [50.5, 9];

  return (
    <MapContainer
      center={center}
      zoom={events.length > 0 ? 6 : 4}
      scrollWheelZoom
      className="h-[600px] w-full rounded-xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-bijdragers'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds events={events} />
      {events.map((e) => (
        <Marker key={e.id} position={[e.lat, e.lng]} icon={pinIcon}>
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{e.title}</p>
              <p className="text-slate-500">
                {e.city} · {new Date(e.startTime).toLocaleDateString("nl-NL", { day: "numeric", month: "long" })}
              </p>
              <Link href={`/evenementen/${e.id}`} className="text-indigo-600 underline">
                Bekijk details
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
