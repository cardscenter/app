import type { EventType, EntryPriceMode } from "@/lib/events/types";

export interface TicketTypeInput {
  name: string;
  price: string;
}

export interface EventFormState {
  eventType: EventType | "";
  title: string;
  description: string; // HTML uit de rich-text-editor

  // Datum/tijd — wandklok in de event-tijdzone (afgeleid uit land).
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;

  // Toernooi-specifiek (alleen voor OP_TOERNOOI)
  tournamentFormat: string;
  isSanctioned: boolean;
  prizePool: string;

  // Locatie
  venueName: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;

  // Entree
  entryType: "FREE" | "PAID";
  entryPriceMode: EntryPriceMode;
  entryPrice: string;
  entryCurrency: string;
  ticketTypes: TicketTypeInput[];
  childrenFreeUntilAge: string;

  // Standhouders
  vendorTablePrice: string;
  vendorChairPrice: string;
  vendorPowerAvailable: boolean;
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

  maxVisitors: string;
  registrationRequired: boolean;
  registrationUrl: string;

  // Banner/flyer (≈3:1)
  coverImage: string;

  // Promotie (uitgelichte banner)
  promote: boolean;
  promoteDays: number;
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
  entryType: "FREE",
  entryPriceMode: "SINGLE",
  entryPrice: "",
  entryCurrency: "EUR",
  ticketTypes: [{ name: "", price: "" }],
  childrenFreeUntilAge: "",
  vendorTablePrice: "",
  vendorChairPrice: "",
  vendorPowerAvailable: false,
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
  maxVisitors: "",
  registrationRequired: false,
  registrationUrl: "",
  coverImage: "",
  promote: false,
  promoteDays: 14,
};

export type EventFieldSetter = <K extends keyof EventFormState>(field: K, value: EventFormState[K]) => void;
