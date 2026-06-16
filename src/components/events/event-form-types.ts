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

  // Entree (valuta is altijd EUR — heel Europa, geen keuze nodig)
  entryType: "FREE" | "PAID";
  ticketTypes: NamePriceInput[]; // bezoekers-tickets, zelf gedefinieerd
  registrationUrl: string; // verplicht bij betaald — waar tickets gekocht worden

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

  coverImage: string;

  promote: boolean;
  promoteUntil: string; // yyyy-MM-dd — banner uitgelicht tot en met deze datum
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
  entryType: "PAID", // beurzen hebben bijna altijd tickets
  ticketTypes: [],
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
  coverImage: "",
  promote: false,
  promoteUntil: "",
};

export type EventFieldSetter = <K extends keyof EventFormState>(field: K, value: EventFormState[K]) => void;
