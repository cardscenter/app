import { describe, expect, it } from "vitest";
import {
  addCombo,
  addLooseLine,
  basketCount,
  basketSavings,
  basketTotal,
  changeQty,
  comboPrice,
  discountAmount,
  drinksOnly,
  hasFood,
  lineKey,
  normalizeCode,
  pointsToApply,
  removeLine,
  sanitizeBasket,
  setLineRemoved,
  stepsFor,
  nextStepIndex,
  collectorNumbers,
  type BasketLine,
  type PricedItem,
} from "@/lib/food/pricing";
import { DEFAULT_ITEMS, DEFAULT_CATEGORIES } from "@/lib/food/menu-data";

const ITEMS: Record<string, PricedItem> = Object.fromEntries(
  DEFAULT_ITEMS.map((i) => [i.id, { id: i.id, price: i.price, category: i.cat, flow: i.flow ?? null, ingredientCount: i.ing?.length ?? 0 }]),
);
const item = (id: string) => ITEMS[id];
let seq = 0;
const nextG = () => `g${++seq}`;

describe("menuvoordeel", () => {
  it("burger + friet + saus + drankje: friet -1,00, eerste saus gratis, drankje -0,50", () => {
    const b = addCombo([], { id: "bacon", removed: [], fries: "friet-g", sauces: ["saus-speciaal", "saus-curry"], drink: "fanta" }, nextG);
    expect(b).toHaveLength(5);
    // 9.95 + (4.00-1.00) + 0 (speciaal gratis) + 0.40 + (2.00-0.50) = 14.85
    expect(basketTotal(b, item)).toBe(14.85);
    expect(basketSavings(b, item)).toBe(2.0); // 1.00 + 0.50 (speciaal) + 0.50
    expect(basketCount(b)).toBe(1);
    expect(comboPrice({ id: "bacon", fries: "friet-g", sauces: ["saus-speciaal", "saus-curry"], drink: "fanta" }, item)).toBe(14.85);
  });

  it("zonder onderdelen wordt een combo een los item, identieke regels voegen samen", () => {
    let b = addCombo([], { id: "classic", removed: [], fries: null, sauces: [], drink: null }, nextG);
    expect(b[0].g).toBeNull();
    b = addLooseLine(b, "classic");
    expect(b).toHaveLength(1);
    expect(b[0].qty).toBe(2);
    b = addLooseLine(b, "classic", [1]);
    expect(b).toHaveLength(2);
    expect(lineKey(b[1])).not.toBe(lineKey(b[0]));
  });

  it("aantal op een combo geldt voor alle onderdelen; onderdeel weghalen; alleen main over = los", () => {
    let b = addCombo([], { id: "smash", removed: [], fries: "friet-k", sauces: [], drink: "cola" }, nextG);
    b = changeQty(b, 0, 1);
    expect(b.every((l) => l.qty === 2)).toBe(true);
    expect(basketTotal(b, item)).toBe(round(2 * (11.5 + 2.0 + 1.5)));
    b = removeLine(b, 2); // drankje weg
    expect(b).toHaveLength(2);
    b = removeLine(b, 1); // friet weg → main los
    expect(b).toHaveLength(1);
    expect(b[0].g).toBeNull();
    b = changeQty(b, 0, -2);
    expect(b).toHaveLength(0);
  });

  it("ingrediënten van een losse regel aanpassen voegt duplicaten samen", () => {
    let b = addLooseLine([], "classic", [0]);
    b = addLooseLine(b, "classic", []);
    b = setLineRemoved(b, 1, [0]);
    expect(b).toHaveLength(1);
    expect(b[0].qty).toBe(2);
  });
});

describe("regels", () => {
  it("alleen drinken (en sauzen) is geen eten", () => {
    const b = addLooseLine(addLooseLine([], "cola"), "saus-mayo");
    expect(hasFood(b, item)).toBe(false);
    expect(drinksOnly(b, item)).toBe(true);
    expect(drinksOnly(addLooseLine(b, "nuggets"), item)).toBe(false);
    expect(drinksOnly([], item)).toBe(false);
  });

  it("kortingscodes: procent, vast, nooit meer dan het subtotaal", () => {
    expect(discountAmount(20, { type: "PCT", value: 10 })).toBe(2);
    expect(discountAmount(3, { type: "EUR", value: 5 })).toBe(3);
    expect(discountAmount(0, { type: "EUR", value: 5 })).toBe(0);
    expect(discountAmount(10, null)).toBe(0);
    expect(normalizeCode(" vrien den ")).toBe("VRIENDEN");
  });

  it("combo-stappen: sausstap valt weg bij burger zonder friet; uitverkochte stappen vallen weg", () => {
    const all = { fries: true, sauce: true, drink: true };
    expect(stepsFor("burger", all)).toEqual(["fries", "sauce", "drink"]);
    expect(stepsFor("burger", { ...all, fries: false })).toEqual(["sauce", "drink"]);
    expect(stepsFor("loaded", all)).toEqual(["drink"]);
    expect(stepsFor(null, all)).toEqual([]);
    const steps = stepsFor("burger", all);
    expect(nextStepIndex({ id: "bacon", fries: null }, "burger", steps, 0)).toBe(2);
    expect(nextStepIndex({ id: "bacon", fries: "friet-k" }, "burger", steps, 0)).toBe(1);
  });

  it("sanitizeBasket: onbekende items weg, groep zonder main wordt los, aantallen begrensd", () => {
    const raw = [
      { id: "bacon", qty: 1, removed: [0, 99, -1, 0], g: "g1", role: "main" },
      { id: "friet-k", qty: 50, removed: [], g: "g1", role: "fries" },
      { id: "weg", qty: 1, removed: [], g: null, role: null },
      { id: "fanta", qty: 1, removed: [], g: "g2", role: "drink" },
    ];
    const { basket, dropped } = sanitizeBasket(raw, item);
    expect(dropped).toEqual(["weg"]);
    expect(basket).toHaveLength(3);
    expect(basket[0].removed).toEqual([0]);
    expect(basket[1].qty).toBe(1); // volgt het hoofdgerecht
    expect(basket[2].g).toBeNull();
    expect(basket[2].role).toBeNull();
    expect(basketSavings(basket, item)).toBe(1.0);
  });

  it("collector-nummers", () => {
    const nos = collectorNumbers(DEFAULT_ITEMS.map((i) => ({ id: i.id, category: i.cat })), DEFAULT_CATEGORIES);
    expect(nos.classic).toBe("B·001/005");
    expect(nos["monster-nitro"]).toBe("D·018/018");
  });
});

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export type _L = BasketLine;

describe("pointsToApply", () => {
  it("gebruikt het hele saldo als dat kleiner is dan het bedrag", () => {
    expect(pointsToApply(12.5, 340)).toEqual({ points: 340, euro: 3.4 });
  });
  it("dekt hoogstens het bedrag, op de cent", () => {
    expect(pointsToApply(7.95, 5000)).toEqual({ points: 795, euro: 7.95 });
  });
  it("rondt het bedrag af op centen (float-ruis)", () => {
    expect(pointsToApply(0.1 + 0.2, 1000).points).toBe(30);
  });
  it("geeft niets bij een leeg saldo, negatief saldo of bedrag nul", () => {
    expect(pointsToApply(10, 0).points).toBe(0);
    expect(pointsToApply(10, -50).points).toBe(0);
    expect(pointsToApply(0, 500).points).toBe(0);
  });
});
