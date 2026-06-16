import type { EventType } from "@/lib/events/types";
import type { EventUpsellType } from "@/lib/events/upsell-config";
import type { EventLabelType, LabelColor } from "@/lib/events/labels";

export interface EventFormState {
  eventType: EventType | "";
  title: string;
  description: string;

  // Datum/tijd — wandklok in de event-tijdzone (afgeleid uit land).
  startDate: string; // yyyy-MM-dd
  startTime: string; // HH:mm
  endDate: string; // optioneel; leeg = zelfde dag als start
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
  country: string; // ISO-2

  // Entree
  entryType: "FREE" | "PAID";
  entryPrice: string;
  entryCurrency: string;

  // Activiteiten + faciliteiten
  canPlay: boolean;
  canTrade: boolean;
  canSell: boolean;
  hasParking: boolean;
  hasFood: boolean;

  maxVisitors: string;
  registrationRequired: boolean;
  registrationUrl: string;

  // Foto (thumbnail/flyer) — één afbeelding
  coverImage: string;

  // Promotie
  upsells: { type: EventUpsellType; days: number }[];
  labels: { type: EventLabelType; colorKey: LabelColor }[];
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
  entryPrice: "",
  entryCurrency: "EUR",
  canPlay: false,
  canTrade: false,
  canSell: false,
  hasParking: false,
  hasFood: false,
  maxVisitors: "",
  registrationRequired: false,
  registrationUrl: "",
  coverImage: "",
  upsells: [],
  labels: [],
};

export type EventFieldSetter = <K extends keyof EventFormState>(
  field: K,
  value: EventFormState[K],
) => void;
