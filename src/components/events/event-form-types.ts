import type { EventType } from "@/lib/events/types";

export interface NamePriceInput {
  name: string;
  price: string;
  description: string; // extra info (bv. wat zit er bij een VIP-ticket)
  serviceFee: string; // optionele servicekosten, klein onder de prijs
}

export interface EventFormState {
  eventType: EventType | "";
  title: string;
  description: string; // HTML

  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;

  tournamentFormat: string;
  isSanctioned: boolean;
  prizePool: string;

  venueName: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;

  // Organisator (bedrijf kan afwijken van de account-houder)
  organizerName: string; // weergavenaam-override (leeg = accountnaam)
  organizerWebsite: string;

  // Entree (valuta is altijd EUR — heel Europa, geen keuze nodig)
  entryType: "FREE" | "PAID";
  ticketTypes: NamePriceInput[]; // bezoekers-tickets, zelf gedefinieerd
  ticketSaleMode: "ONLINE" | "DOOR"; // online ticketlink of alleen aan de deur
  registrationUrl: string; // verplicht bij ONLINE — waar tickets gekocht worden

  // Standhouders — zelf-gedefinieerde opties
  vendorOptions: NamePriceInput[];
  vendorInfo: string;

  // Activiteiten
  canPlay: boolean;
  canTrade: boolean;
  canSell: boolean;

  // Faciliteiten
  hasParking: boolean;
  hasFood: boolean;
  hasToilets: boolean;
  hasWifi: boolean;
  cardPayment: boolean;
  wheelchairAccessible: boolean;
  hasCloakroom: boolean;
  childFriendly: boolean;

  maxVisitors: string;
  totalTables: string; // totaal aantal tafels (standhouder-capaciteit)

  coverImage: string;
  galleryImages: string[]; // impressiefoto's van eerdere jaargangen
  videoUrl: string; // YouTube/Vimeo-link (optioneel)

  promote: boolean;
  promoteUntil: string; // yyyy-MM-dd — banner uitgelicht tot en met deze datum

  spotlight: boolean; // homepage-spotlight (op de hoofd-homepage van de site)
  spotlightUntil: string; // yyyy-MM-dd — spotlight tot en met deze datum
}

export const INITIAL_EVENT_FORM: EventFormState = {
  eventType: "",
  title: "",
  description: "",
  startDate: "",
  startTime: "10:00",
  endDate: "",
  endTime: "17:00",
  tournamentFormat: "",
  isSanctioned: false,
  prizePool: "",
  venueName: "",
  street: "",
  houseNumber: "",
  postalCode: "",
  city: "",
  country: "NL",
  organizerName: "",
  organizerWebsite: "",
  entryType: "PAID", // beurzen hebben bijna altijd tickets
  ticketTypes: [],
  ticketSaleMode: "ONLINE",
  registrationUrl: "",
  vendorOptions: [],
  vendorInfo: "",
  canPlay: false,
  canTrade: false,
  canSell: false,
  hasParking: false,
  hasFood: false,
  hasToilets: false,
  hasWifi: false,
  cardPayment: false,
  wheelchairAccessible: false,
  hasCloakroom: false,
  childFriendly: false,
  maxVisitors: "",
  totalTables: "",
  coverImage: "",
  galleryImages: [],
  videoUrl: "",
  promote: false,
  promoteUntil: "",
  spotlight: false,
  spotlightUntil: "",
};

export type EventFieldSetter = <K extends keyof EventFormState>(field: K, value: EventFormState[K]) => void;
