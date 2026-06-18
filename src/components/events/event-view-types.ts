// Gedeelde shape voor de event-render-componenten (card / kalender / quick-view).
// Plain serialiseerbare data vanuit de server-page.

export interface EventListItem {
  id: string;
  title: string;
  eventType: string;
  venueName: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
  startTime: string; // ISO
  endTime: string; // ISO
  timezone: string;
  coverImage: string | null;
  shortDescription: string | null; // korte platte-tekst-snippet (kaart-popup)
  entryType: string;
  entryPrice: number | null;
  entryCurrency: string | null;
  isOfficial: boolean;
  lat: number | null;
  lng: number | null;
  featured?: boolean; // actieve banner-upsell — krijgt voorrang in de kalender
}
