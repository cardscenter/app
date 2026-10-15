import type { BasketLine } from "@/lib/food/pricing";
import type { MenuView } from "@/lib/food/menu-server";

/** Client-sessie van de bestelapp (localStorage `cc-session-v2`). */
export interface FoodSession {
  mode: "TABLE" | "BAR";
  table: number;
  name: string;
  basket: BasketLine[];
  gseq: number;
  note: string;
  code: string | null;
  /** Eigen bestellingen op dit toestel: id + gast-token (nodig voor de statuspagina). */
  myOrders: Array<{ id: string; token: string; number: number; at: number }>;
  /** "Nog een keer?": compacte kopie van de laatste 5 bestellingen. */
  history: Array<{ number: number; at: number; lines: BasketLine[]; total: number }>;
}

export const EMPTY_SESSION: FoodSession = {
  mode: "TABLE",
  table: 0,
  name: "",
  basket: [],
  gseq: 0,
  note: "",
  code: null,
  myOrders: [],
  history: [],
};

export type MenuData = Pick<MenuView, "categories" | "items" | "byId">;

export type Screen = "welcome" | "menu" | "overview" | "pay";

export interface SheetCombo {
  type: "combo";
  id: string;
  removed: number[];
  steps: Array<"fries" | "sauce" | "drink">;
  i: number;
  fries: string | null;
  sauces: string[];
  drink: string | null;
}
export interface SheetCustom {
  type: "custom";
  id: string;
  removed: number[];
  lineIdx: number | null;
}
export interface SheetInfo {
  type: "info";
  id: string;
}
export interface SheetHistory {
  type: "history";
}
export type Sheet = SheetCombo | SheetCustom | SheetInfo | SheetHistory;
