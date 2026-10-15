/**
 * Menudata van de bestelapp (Community Hub, Fase 4). Puur bestand, port van
 * `cards-center-bestelapp/index.html` (content-blok). De DB (MenuCategory,
 * MenuItem, DiscountCode) wordt hieruit lazy geseed; daarna is de DB leidend
 * (prijzen, uitverkocht, aan/uit) en dient dit bestand alleen als seed.
 *
 * Prijzen zijn placeholders (zie de spec), dranken zijn vastgesteld.
 */

/** Menuvoordeel: korting per onderdeel zodra het bij een hoofdgerecht in één combo zit. */
export const DEAL = { fries: 1.0, drink: 0.5 } as const;
export const SAUCE_PRICE = 0.4;
export const SAUCE_ML = 37;
export const SPICE_MAX = 4;
export const TIPS = [0, 0.5, 1, 2] as const;
export const NOTE_MAX = 140;
export const NAME_MAX = 24;
export const TABLE_MIN = 1;
export const TABLE_MAX = 16;
export const WAIT_DEFAULT = 15;
export const WAIT_OPTIONS = [15, 20, 30, 45, 60] as const;
export const VAT_RATE = 0.09;
/** Online bestelling zonder betaling vervalt na zoveel minuten (cron). */
export const UNPAID_ONLINE_MINUTES = 30;
/** Eerste bestelnummer van de dag. */
export const FIRST_ORDER_NUMBER = 101;

export type FlowKey = "burger" | "fries" | "snack" | "loaded";
export type StepKey = "fries" | "sauce" | "drink";
export const FLOWS: Record<FlowKey, StepKey[]> = {
  burger: ["fries", "sauce", "drink"],
  fries: ["sauce"],
  snack: ["sauce"],
  loaded: ["drink"],
};

export type I18nPair = { nl: string; en: string };
const I = (nl: string, en: string): I18nPair => ({ nl, en });

/** De 14 wettelijke allergenen (EU 1169/2011). */
export const ALLERGENS: Record<string, I18nPair> = {
  gluten: I("Gluten", "Gluten"),
  schaaldieren: I("Schaaldieren", "Crustaceans"),
  ei: I("Ei", "Egg"),
  vis: I("Vis", "Fish"),
  pinda: I("Pinda", "Peanut"),
  soja: I("Soja", "Soy"),
  melk: I("Melk", "Milk"),
  noten: I("Noten", "Nuts"),
  selderij: I("Selderij", "Celery"),
  mosterd: I("Mosterd", "Mustard"),
  sesam: I("Sesam", "Sesame"),
  sulfiet: I("Sulfiet", "Sulphites"),
  lupine: I("Lupine", "Lupin"),
  weekdieren: I("Weekdieren", "Molluscs"),
};
const BUN = ["gluten", "ei", "melk", "sesam"];

export const DEFAULT_CATEGORIES: Array<{ key: string; code: string; name: string; nameEn: string }> = [
  { key: "burgers", code: "B", name: "Burgers", nameEn: "Burgers" },
  { key: "friet", code: "F", name: "Friet", nameEn: "Fries" },
  { key: "loaded", code: "L", name: "Loaded fries", nameEn: "Loaded fries" },
  { key: "snacks", code: "S", name: "Snacks & sharing", nameEn: "Snacks & sharing" },
  { key: "sauzen", code: "C", name: "Sauzen", nameEn: "Sauces" },
  { key: "drank", code: "D", name: "Drinken", nameEn: "Drinks" },
];

export interface MenuItemSeed {
  id: string;
  cat: string;
  art: string;
  img?: string;
  price: number;
  flow?: FlowKey;
  veg?: boolean;
  spice?: number;
  tag?: I18nPair;
  c?: string;
  name: I18nPair;
  d: I18nPair;
  al: string[];
  ing?: I18nPair[];
}

const F = (f: string) => `/images/menu/food/${f}.webp`;
const D = (f: string) => `/images/menu/drank/${f}.webp`;
const sauceD = (nl: string, en: string): I18nPair => I(`${nl}, ${SAUCE_ML} ml.`, `${en}, ${SAUCE_ML} ml.`);

export const DEFAULT_ITEMS: MenuItemSeed[] = [
  { id: "classic", cat: "burgers", art: "burger", img: F("classic"), price: 8.5, flow: "burger", name: I("Classic Cheeseburger", "Classic Cheeseburger"), d: I("Rundvlees, cheddar, augurk en ui. De klassieker.", "Beef, cheddar, pickles and onion. The classic."), al: [...BUN, "mosterd"], ing: [I("Cheddar", "Cheddar"), I("Augurk", "Pickles"), I("Ui", "Onion"), I("Ketchup", "Ketchup"), I("Mosterd", "Mustard")] },
  { id: "bacon", cat: "burgers", art: "burger", img: F("bacon"), price: 9.95, flow: "burger", tag: I("Favoriet", "Favourite"), name: I("Bacon Deluxe", "Bacon Deluxe"), d: I("Krokante bacon, cheddar, sla, tomaat en burgersaus.", "Crispy bacon, cheddar, lettuce, tomato and burger sauce."), al: [...BUN, "mosterd"], ing: [I("Bacon", "Bacon"), I("Cheddar", "Cheddar"), I("Sla", "Lettuce"), I("Tomaat", "Tomato"), I("Rode ui", "Red onion"), I("Burgersaus", "Burger sauce")] },
  { id: "smash", cat: "burgers", art: "burger", img: F("smash"), price: 11.5, flow: "burger", name: I("Double Smash", "Double Smash"), d: I("Twee smashed patties, dubbel cheddar, gekaramelliseerde ui.", "Two smashed patties, double cheddar, caramelised onion."), al: [...BUN, "mosterd"], ing: [I("Cheddar", "Cheddar"), I("Gekaramelliseerde ui", "Caramelised onion"), I("Augurk", "Pickles"), I("Smashsaus", "Smash sauce")] },
  { id: "chicken", cat: "burgers", art: "burger", img: F("chicken"), price: 9.5, flow: "burger", name: I("Crispy Chicken", "Crispy Chicken"), d: I("Krokante kipfilet met sla, tomaat en knoflookmayo.", "Crispy chicken fillet with lettuce, tomato and garlic mayo."), al: [...BUN, "mosterd"], ing: [I("Sla", "Lettuce"), I("Tomaat", "Tomato"), I("Knoflookmayo", "Garlic mayo")] },
  { id: "veggie", cat: "burgers", art: "burger", img: F("veggie"), price: 9.5, flow: "burger", veg: true, name: I("Veggie Burger", "Veggie Burger"), d: I("Vegetarische burger met rucola, tomaat en burgersaus.", "Vegetarian patty with rocket, tomato and burger sauce."), al: [...BUN, "mosterd"], ing: [I("Rucola", "Rocket"), I("Tomaat", "Tomato"), I("Burgersaus", "Burger sauce")] },

  { id: "friet-k", cat: "friet", art: "fries", img: F("friet"), price: 3.0, flow: "fries", veg: true, al: [], name: I("Friet klein", "Fries, small"), d: I("Verse friet, krokant gebakken. Kleine portie.", "Fresh fries, fried crisp. Small portion.") },
  { id: "friet-m", cat: "friet", art: "fries", img: F("friet"), price: 3.5, flow: "fries", veg: true, al: [], name: I("Friet middel", "Fries, medium"), d: I("Verse friet, krokant gebakken. Normale portie.", "Fresh fries, fried crisp. Regular portion.") },
  { id: "friet-g", cat: "friet", art: "fries", img: F("friet"), price: 4.0, flow: "fries", veg: true, al: [], name: I("Friet groot", "Fries, large"), d: I("Verse friet, krokant gebakken. Ruime portie.", "Fresh fries, fried crisp. Generous portion.") },

  { id: "lf-bacon", cat: "loaded", art: "loaded", img: F("lf-bacon"), price: 8.95, flow: "loaded", al: ["melk", "mosterd"], name: I("Loaded Bacon Cheddar", "Loaded Bacon Cheddar"), d: I("Friet met krokante bacon, warme cheddarsaus en lente-ui.", "Fries with crispy bacon, warm cheddar sauce and spring onion."), ing: [I("Bacon", "Bacon"), I("Cheddarsaus", "Cheddar sauce"), I("Lente-ui", "Spring onion")] },
  { id: "lf-pork", cat: "loaded", art: "loaded", img: F("lf-pork"), price: 8.95, flow: "loaded", tag: I("Favoriet", "Favourite"), al: ["ei", "mosterd"], name: I("Loaded Pulled Pork", "Loaded Pulled Pork"), d: I("Friet met pulled pork, mayonaise en lente-ui.", "Fries with pulled pork, mayonnaise and spring onion."), ing: [I("Mayonaise", "Mayonnaise"), I("Lente-ui", "Spring onion")] },
  // Bewust zonder Vega-label: Parmezaanse kaas is niet vegetarisch (dierlijk stremsel)
  { id: "lf-truffel", cat: "loaded", art: "loaded", img: F("lf-truffel"), price: 8.95, flow: "loaded", al: ["ei", "mosterd", "melk"], name: I("Loaded Truffel", "Loaded Truffle"), d: I("Friet met truffelmayo en Parmezaanse kaas.", "Fries with truffle mayo and Parmesan."), ing: [I("Truffelmayo", "Truffle mayo"), I("Parmezaanse kaas", "Parmesan")] },

  { id: "nuggets", cat: "snacks", art: "nuggets", price: 4.95, flow: "snack", al: ["gluten", "ei"], name: I("Kipnuggets (6)", "Chicken nuggets (6)"), d: I("Met een dipsaus naar keuze.", "With a dip of your choice.") },
  { id: "tenders", cat: "snacks", art: "sticks", price: 5.5, flow: "snack", al: ["gluten", "ei"], name: I("Chicken tenders (4)", "Chicken tenders (4)"), d: I("Malse kipreepjes in een krokant jasje, met een saus naar keuze.", "Tender chicken strips in a crispy coating, with a dip of your choice.") },
  { id: "frikandel-sp", cat: "snacks", art: "sticks", price: 3.25, al: ["gluten", "soja", "ei", "mosterd", "selderij"], name: I("Frikandel speciaal", "Frikandel speciaal"), d: I("Met mayonaise, curry en uitjes.", "With mayonnaise, curry ketchup and onions."), ing: [I("Mayonaise", "Mayonnaise"), I("Curry", "Curry ketchup"), I("Uitjes", "Onions")] },
  { id: "broodje-frikandel", cat: "snacks", art: "rolls", price: 3.5, al: [...BUN, "soja", "selderij", "mosterd"], name: I("Broodje frikandel", "Frikandel roll"), d: I("Frikandel speciaal op een zacht broodje.", "Frikandel speciaal on a soft roll."), ing: [I("Mayonaise", "Mayonnaise"), I("Curry", "Curry ketchup"), I("Uitjes", "Onions")] },
  { id: "mozza", cat: "snacks", art: "sticks", price: 4.95, flow: "snack", veg: true, al: ["gluten", "melk", "ei"], name: I("Mozzarella sticks (5)", "Mozzarella sticks (5)"), d: I("Gepaneerd, met tomatendip.", "Breaded, with tomato dip.") },
  { id: "uienringen", cat: "snacks", art: "balls", price: 3.95, flow: "snack", veg: true, al: ["gluten"], name: I("Uienringen (6)", "Onion rings (6)"), d: I("Krokant bierbeslag, met een saus naar keuze.", "Crispy beer batter, with a dip of your choice.") },
  { id: "vlammetjes", cat: "snacks", art: "rolls", price: 4.5, flow: "snack", spice: 2, al: ["gluten", "soja", "selderij"], name: I("Vlammetjes (5)", "Vlammetjes (5)"), d: I("Pittige mini loempia’s met gekruid gehakt.", "Spicy mini spring rolls with seasoned minced meat.") },
  { id: "bitter", cat: "snacks", art: "balls", price: 6.5, flow: "snack", al: ["gluten", "melk", "selderij", "mosterd"], name: I("Bitterballen (8)", "Bitterballen (8)"), d: I("Met mosterd. Hollands goud.", "With mustard. Dutch gold.") },
  { id: "loempia", cat: "snacks", art: "rolls", price: 5.5, flow: "snack", al: ["gluten", "soja", "selderij"], name: I("Mini loempia’s (6)", "Mini spring rolls (6)"), d: I("Met zoete chilisaus.", "With sweet chilli sauce.") },
  { id: "box", cat: "snacks", art: "box", price: 16.95, flow: "snack", tag: I("Om te delen", "To share"), al: ["gluten", "ei", "melk", "soja", "selderij", "mosterd"], name: I("Sharing box", "Sharing box"), d: I("Nuggets, mozzarella sticks, bitterballen, loempia’s en friet, met een dipsaus naar keuze. Voor 3 tot 4 spelers.", "Nuggets, mozzarella sticks, bitterballen, spring rolls and fries, with a dip of your choice. For 3 to 4 players.") },

  { id: "saus-curry", cat: "sauzen", art: "dip", c: "#C9472B", price: SAUCE_PRICE, al: ["mosterd", "selderij"], name: I("Curry", "Curry ketchup"), d: sauceD("Bakje curryketchup", "Pot of curry ketchup") },
  { id: "saus-mayo", cat: "sauzen", art: "dip", c: "#F6EDC8", price: SAUCE_PRICE, al: ["ei", "mosterd"], name: I("Mayonaise", "Mayonnaise"), d: sauceD("Bakje mayonaise", "Pot of mayonnaise") },
  { id: "saus-ketchup", cat: "sauzen", art: "dip", c: "#C8231E", price: SAUCE_PRICE, al: [], name: I("Ketchup", "Ketchup"), d: sauceD("Bakje tomatenketchup", "Pot of tomato ketchup") },
  { id: "saus-bbq", cat: "sauzen", art: "dip", c: "#5A2A17", price: SAUCE_PRICE, al: ["mosterd"], name: I("BBQ-saus", "BBQ sauce"), d: sauceD("Bakje rokerige BBQ-saus", "Pot of smoky BBQ sauce") },
  { id: "saus-chili", cat: "sauzen", art: "dip", c: "#E8562E", price: SAUCE_PRICE, spice: 1, al: [], name: I("Zoete chili", "Sweet chilli"), d: sauceD("Bakje zoete chilisaus", "Pot of sweet chilli sauce") },
  { id: "saus-knoflook", cat: "sauzen", art: "dip", c: "#F3F0E6", price: SAUCE_PRICE, al: ["ei", "melk"], name: I("Knoflooksaus", "Garlic sauce"), d: sauceD("Bakje knoflooksaus", "Pot of garlic sauce") },
  { id: "saus-speciaal", cat: "sauzen", art: "dip", c: "#E89A3C", price: 0.5, al: ["ei", "mosterd"], name: I("Speciaal", "Speciaal"), d: sauceD("Bakje speciaalsaus: mayonaise, curry en uitjes", "Pot of speciaal sauce: mayonnaise, curry ketchup and onions") },
  { id: "saus-joppie", cat: "sauzen", art: "dip", c: "#E9C46A", price: SAUCE_PRICE, al: ["ei", "mosterd"], name: I("Joppiesaus", "Joppie sauce"), d: sauceD("Bakje joppiesaus", "Pot of Joppie sauce") },
  { id: "saus-sate", cat: "sauzen", art: "dip", c: "#B5651D", price: SAUCE_PRICE, al: ["pinda", "soja"], name: I("Satésaus", "Satay sauce"), d: sauceD("Bakje warme satésaus", "Pot of warm satay sauce") },
  { id: "saus-andalouse", cat: "sauzen", art: "dip", c: "#F08A4B", price: SAUCE_PRICE, spice: 1, al: ["ei", "mosterd"], name: I("Andalouse", "Andalouse"), d: sauceD("Bakje andalousesaus, licht pittig", "Pot of andalouse sauce, mildly spicy") },
  { id: "saus-truffel", cat: "sauzen", art: "dip", c: "#D9C9A8", price: SAUCE_PRICE, al: ["ei", "mosterd"], name: I("Truffelmayo", "Truffle mayo"), d: sauceD("Bakje truffelmayonaise", "Pot of truffle mayonnaise") },
  { id: "saus-samurai", cat: "sauzen", art: "dip", c: "#E0362C", price: SAUCE_PRICE, spice: 3, al: ["ei", "mosterd"], name: I("Samurai", "Samurai"), d: sauceD("Bakje samuraisaus, pittig", "Pot of samurai sauce, spicy") },

  { id: "cola", cat: "drank", art: "can", c: "#D3171F", img: D("cola"), price: 2.0, al: [], name: I("Coca-Cola", "Coca-Cola"), d: I("Blik 33 cl", "Can 33 cl") },
  { id: "zero", cat: "drank", art: "can", c: "#1E1E20", img: D("zero"), price: 2.0, al: [], name: I("Coca-Cola Zero", "Coca-Cola Zero"), d: I("Blik 33 cl", "Can 33 cl") },
  { id: "vanilla", cat: "drank", art: "can", c: "#D8B36A", img: D("vanilla"), price: 2.0, al: [], name: I("Coca-Cola Vanilla", "Coca-Cola Vanilla"), d: I("Blik 33 cl", "Can 33 cl") },
  { id: "cherry", cat: "drank", art: "can", c: "#8E1B3A", img: D("cherry"), price: 2.0, al: [], name: I("Coca-Cola Cherry", "Coca-Cola Cherry"), d: I("Blik 33 cl", "Can 33 cl") },
  { id: "fanta", cat: "drank", art: "can", c: "#F07A12", img: D("fanta"), price: 2.0, al: [], name: I("Fanta Orange", "Fanta Orange"), d: I("Blik 33 cl", "Can 33 cl") },
  { id: "sprite", cat: "drank", art: "can", c: "#1B9A4B", img: D("sprite"), price: 2.0, al: [], name: I("Sprite", "Sprite"), d: I("Blik 33 cl", "Can 33 cl") },
  { id: "icetea", cat: "drank", art: "can", c: "#5FA843", img: D("icetea"), price: 2.0, al: [], name: I("Lipton Ice Tea Green", "Lipton Ice Tea Green"), d: I("Blik 33 cl", "Can 33 cl") },
  { id: "icetea-spark", cat: "drank", art: "can", c: "#E8B414", img: D("icetea-spark"), price: 2.0, al: [], name: I("Lipton Ice Tea Sparkling", "Lipton Ice Tea Sparkling"), d: I("Blik 33 cl", "Can 33 cl") },
  { id: "spa", cat: "drank", art: "bottle", c: "#2E74C9", img: D("spa"), price: 1.5, al: [], name: I("Spa Reine", "Spa Reine"), d: I("Flesje 33 cl, plat water", "Bottle 33 cl, still water") },
  { id: "redbull", cat: "drank", art: "can", c: "#1F3F8F", img: D("redbull"), price: 3.0, al: [], name: I("Red Bull", "Red Bull"), d: I("Blik 25 cl", "Can 25 cl") },
  { id: "redbull-sf", cat: "drank", art: "can", c: "#4A9BD1", img: D("redbull-sf"), price: 3.0, al: [], name: I("Red Bull Sugarfree", "Red Bull Sugarfree"), d: I("Blik 25 cl, zonder suiker", "Can 25 cl, sugar free") },
  { id: "monster-original", cat: "drank", art: "can", c: "#2E8B2E", img: D("monster-original"), price: 3.5, al: [], name: I("Monster Energy", "Monster Energy"), d: I("Blik 50 cl. Het origineel.", "Can 50 cl. The original.") },
  { id: "monster-zero", cat: "drank", art: "can", c: "#3C3C40", img: D("monster-zero"), price: 3.5, al: [], name: I("Monster Zero Sugar", "Monster Zero Sugar"), d: I("Blik 50 cl. Zonder suiker.", "Can 50 cl. Sugar free.") },
  { id: "monster-ultra", cat: "drank", art: "can", c: "#DCDCE0", img: D("monster-ultra"), price: 3.5, al: [], name: I("Monster Ultra", "Monster Ultra"), d: I("Blik 50 cl. Suikervrij, citrus.", "Can 50 cl. Sugar free, citrus.") },
  { id: "monster-violet", cat: "drank", art: "can", c: "#7B3FA0", img: D("monster-violet"), price: 3.5, al: [], name: I("Monster Ultra Violet", "Monster Ultra Violet"), d: I("Blik 50 cl. Suikervrij.", "Can 50 cl. Sugar free.") },
  { id: "monster-pipeline", cat: "drank", art: "can", c: "#E8457A", img: D("monster-pipeline"), price: 3.5, al: [], name: I("Monster Pipeline Punch", "Monster Pipeline Punch"), d: I("Blik 50 cl. Passievrucht, sinaasappel en guave.", "Can 50 cl. Passion fruit, orange and guava.") },
  { id: "monster-pacific", cat: "drank", art: "can", c: "#3A5FBF", img: D("monster-pacific"), price: 3.5, al: [], name: I("Monster Pacific Punch", "Monster Pacific Punch"), d: I("Blik 50 cl. Fruitpunch.", "Can 50 cl. Fruit punch.") },
  { id: "monster-nitro", cat: "drank", art: "can", c: "#B08D57", img: D("monster-nitro"), price: 3.5, al: [], name: I("Monster Nitro", "Monster Nitro"), d: I("Blik 50 cl. Super Dry, extra fris.", "Can 50 cl. Super Dry, extra crisp.") },
];

/** Placeholder-kortingscodes (in de DB beheerbaar). */
export const DEFAULT_CODES: Array<{ code: string; type: "PCT" | "EUR"; value: number }> = [
  { code: "VRIENDEN", type: "PCT", value: 10 },
  { code: "CARDS5", type: "EUR", value: 5 },
];
