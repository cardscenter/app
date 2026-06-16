// Gedeelde shape voor de event-render-componenten (card / kalender / quick-view).
// Plain serialiseerbare data vanuit de server-page.

export interface EventListItem {
  id: string;
  title: string;
  eventType: string;
  venueName: string;
  city: string;
  country: string;
  startTime: string; // ISO
  endTime: string; // ISO
  timezone: string;
  coverImage: string | null;
  entryType: string;
  entryPrice: number | null;
  entryCurrency: string | null;
  isOfficial: boolean;
  lat: number | null;
  lng: number | null;
  labels: { type: string; colorKey: string }[];
}
