---
name: pokewallet-api
description: Use whenever working with the PokeWallet API (api.pokewallet.io) — pricing fetches, sync code, schema changes, debugging price issues, building bulk refreshers, or anything touching src/lib/pokewallet/. Contains all endpoints, rate limits, data shapes, and architectural decisions for this project.
user_invocable: false
---

# PokeWallet API — Cards Center integratie

PokeWallet (api.pokewallet.io) is **dé primaire pricing-bron** voor Cards Center. Verving pokemontcg.io en de meeste TCGdex pricing-functionaliteit. Geactiveerd na veel testen op 2026-04-19 omdat het als enige bron volledige reverse-holo data biedt.

## Waarom PokeWallet (samenvatting van de research)

We hebben 4 bronnen vergeleken voor de "Klink Black Bolt #139" bug-kaart (toonde €14,31 i.p.v. werkelijke €4,80):

| bron | Klink #139 avg | RH-data | Actueel |
|---|---|---|---|
| TCGdex (vorige primary) | €14,31 ❌ | ✓ | dagelijks |
| pokemontcg.io | €4,60 | ✓ | stale (vaak 5+ mnd) |
| tcggo | €4,84 | ❌ **geen RH** | live |
| **PokeWallet** | **€4,52** ✅ | **✓ live** | live |

PokeWallet won omdat het als enige (a) live is én (b) volledige RH-data heeft per CardMarket variant_type.

## Authentication

**ALTIJD via env-variabele**, nooit hardcoded:

```bash
# .env.local
POKEWALLET_API_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxxx
```

```ts
// In code
const apiKey = process.env.POKEWALLET_API_KEY;
if (!apiKey) throw new Error("POKEWALLET_API_KEY not configured");

const res = await fetch(url, {
  headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
});
```

Key-formaat: `pk_live_<43+ hex chars>`. Gebruik HTTP-header `X-API-Key` (NIET `Authorization: Bearer`).

## Rate Limits — PRO tier (actief sinds 2026-04-19)

- **5.000 calls/uur** = 120.000/dag = 3.600.000/maand
- Per-minute caps onbekend — bouw rate-limiter in code als veiligheidsnet (bv. max 1000/min)
- Bij `429`: respect `Retry-After` header indien aanwezig, anders exponential backoff (start 1s, max 60s)

## Skill self-management (geautoriseerd door user 2026-04-19)

**Je mag deze skill direct bijwerken zonder toestemming te vragen** wanneer je nieuwe inzichten ontdekt over de PokeWallet API tijdens werk:
- Endpoint-gedrag dat anders blijkt dan gedocumenteerd
- Nieuwe valkuilen of edge cases
- Verschillen tussen wat docs zeggen en wat de API daadwerkelijk doet
- Optimalisaties in call-patronen
- Nieuwe rate-limit info

Document elk update met datum + bron van het inzicht zodat we de evolutie kunnen volgen. Doel: skill blijft altijd de meest actuele single-source-of-truth.

## Status APIs (per 2026-04-19) — ALLEEN POKEWALLET

PokeWallet is **de enige pricing-bron**. Alle andere APIs zijn verwijderd:
- ❌ TCGdex API (verwijderd — image URLs in DB blijven werken via TCGdex CDN, geen calls meer)
- ❌ pokemontcg.io (verwijderd)
- ❌ tcggo (was niet geactiveerd, weg)
- ❌ PriceCharting (verwijderd, ook variants scrape weg)

## Marktprijs-formule (geïmplementeerd 2026-04-19)

`src/lib/display-price.ts` bevat **`getMarktprijs()`** en **`getMarktprijsReverseHolo()`** — outlier-bestendige prijsberekening met 3 lagen verdediging.

### Waarom geen raw `priceAvg` tonen
PokeWallet's `cardmarket.avg` kan vervuild raken door:
1. **PSA10/graded verkopen** in dezelfde idProduct
2. **Damaged listings** als NM gelabeld
3. **idProduct-collisions** (bv. Pawniard BB #142 deelde idProduct met andere variant → CM avg €14,31 vs werkelijk ~€5)
4. **Volledig verkeerde product-mapping** (bv. 151 Squirtle Common toont CM €160 → wijst naar Pokemon Center jumbo, `cardmarket_id=null` in pokewallet response)

### De 3-laags formule (normal):
```ts
function getMarktprijs(card) {
  let prijs = card.priceAvg;

  // 1. Spike-detectie: als avg > 3× low → outlier-spike → use avg7
  if (priceLow > 0 && priceLow * 3 < priceAvg) prijs = priceAvg7 ?? priceTrend ?? priceAvg;

  // 2. TCGPlayer cross-check (rariteit-aware tier!)
  const tpEur = (priceTcgplayerHolofoilMarket ?? priceTcgplayerNormalMarket) * 0.92;
  if (tpEur) {
    if (prijs > tpEur * 5) prijs = tpEur * euTierAdjustment(tpEur, card.rarity);  // EXTREME → trust TP
    else if (tpEur * 1.5 < prijs) prijs = (prijs + tpEur) / 2;                    // MILD → blend
  }
  return Math.round(prijs * 100) / 100;
}
```

### EU-tier adjustment (cruciaal — RARITEIT-AWARE!)

TCGPlayer (US) heeft hoge minimum-prijzen (commons zelden onder $0,18). CardMarket EU heeft bulk-sellers die commons voor €0,02-0,10 verkopen. **Maar alleen voor Common/Uncommon!** Een Double Rare die toevallig €0,75 waard is, circuleert niet in bulk-bins en hoort dus geen 70%-discount te krijgen.

```ts
const COMMON_TIER_RARITIES = new Set(["common", "uncommon"]);

function euTierAdjustmentCommon(tpEur) {       // voor Common/Uncommon
  if (tpEur < 1) return 0.3;                   // commons: EU bulk veel goedkoper
  if (tpEur < 5) return 0.7;                   // mid-low: nog steeds discount
  if (tpEur < 20) return 0.95;
  return 1.1;
}

function euTierAdjustmentRare(tpEur) {         // voor Rare/Holo/Ultra/Double/IR/SIR/etc
  if (tpEur < 1) return 0.8;                   // rares: kleine discount, geen bulk-prijzen
  if (tpEur < 5) return 0.9;
  if (tpEur < 20) return 1.0;
  return 1.1;
}

function euTierAdjustment(tpEur, rarity) {
  return COMMON_TIER_RARITIES.has(rarity?.toLowerCase())
    ? euTierAdjustmentCommon(tpEur)
    : euTierAdjustmentRare(tpEur);
}
// REVERSE HOLO gebruikt dezelfde curve als rare-tier (RH circuleert niet in bulk).
const euTierAdjustmentReverseHolo = euTierAdjustmentRare;
```

**Empirische validatie:**
- Pikachu 151 Common RH €0,38 vs TP Reverse $0,52 (€0,48) → ratio 0,79 ≈ tier 0,8 ✓
- Chien-Pao ex #061 Paldea Evolved (Double Rare): CM €100,50 vervuild, low €3,99, TP $0,92.
  Common-tier zou €0,25 geven (te laag), rare-tier geeft €0,68 ≈ echte €0,75 ✓

**Rariteit MOET** worden meegegeven via `card.rarity`. `getCardPricing()` en `cardToPricingSnapshot()` in `card-helpers.ts` selecteren `rarity` automatisch uit de DB. Als nieuwe call-sites worden toegevoegd, vergeet niet `rarity` in de Prisma `select` op te nemen.

### Reverse Holo special: TCGPlayer-fallback

Pokewallet's CardMarket-RH faalt vaak voor cards met idProduct-collisions (bv. 151 Bulbasaur/Charmander/Squirtle hebben `priceReverseAvg=null` maar wel `priceTcgplayerReverseMarket`). `getMarktprijsReverseHolo` valt automatisch terug op TP Reverse × `euTierAdjustmentReverseHolo`.

### Resultaten van de formule (validatie-cards):
| kaart | raw priceAvg | Marktprijs | RH Marktprijs |
|---|---|---|---|
| 151 Bulbasaur Common | €59 (corrupt) | **€0,07** ✅ | **€0,22** ✅ |
| 151 Squirtle Common | €160 (corrupt) | **€0,08** ✅ | **€0,30** ✅ |
| 151 Pikachu Common | €0,10 | €0,11 | €0,38 (CM-data correct) |
| BB Klink #139 IR | €4,52 | **€4,52** | – |
| BB Pawniard #142 IR | €14,31 (spike) | **€6,57** ✅ | – |
| 151 Bulbasaur IR | €75 | €75 (no fallback) | – |
| PAL Chien-Pao #061 DR | €100,50 (corrupt) | **€0,68** ✅ (was €0,25 met common-tier) | – |

### Belangrijke regels bij wijzigingen
- **Geen TCGPlayer prijs expliciet tonen op de UI** — alleen onze Marktprijs (afgesproken met user 2026-04-19)
- **Manuele overrides** via `priceOverrideAvg` blijven leidend (niet door Marktprijs overschreven)
- **Display in UI**: `cardToPricingSnapshot()` in `card-helpers.ts` returnt `avg = getMarktprijs(card)`. Auction/listing detail pages krijgen automatisch de Marktprijs via `getCardPricing(tcgdexId)`.

## Set-mapping valkuilen (LET OP!)

### Engelse vs Japanse versies
PokeWallet heeft vaak meerdere set_ids per Pokémon-set: één voor JPN, één voor ENG. `lang=eng` filter is nodig. Onze MANUAL_SET_MAPPING is verkeerd geweest voor:
- 151 (sv03.5): mocht NIET 23599 (= JAP "SV2a: Pokemon Card 151"), MOET 23237 (ENG "SV: Scarlet & Violet 151")
- White Flare (sv10.5w): mocht NIET 24350 (= JAP), MOET 24326 (ENG "SV: White Flare")

### Era-base-sets en "X & Y" naming
Onze normalize-regex strippt `^SV1:` of `^SM03:` prefixes maar geen `&`/`-` patronen. Sets als "Sun & Moon" (db) en "SM Base Set" (pw) matchen daarom niet automatisch — handmatig mappen via MANUAL_SET_MAPPING. Geverifieerde mappings (2026-04-19): sm1→1863, sm2→1919, sm3→1957, sm4→2071, sm5→2178, sv01→22873, swsh1→2585, xy1→1387, dp1→1430, swsh10.5→3064, np→1423, hgssp→1453, ru1→1433, swshp→2545, xyp→1451, McD-collecties (2014-2024) zie set-mapping.ts.

**Symptoom:** alle commons in een set tonen onverklaarbaar €1-15 i.p.v. €0,02-0,30. **Oorzaak:** verkeerde JPN-mapping. **Check:** `pokewalletSetCode` veld op de set — als 't iets als `SV2a` of `SV11W` is = Japans, fout.

### Cards-first preference
Onze DB heeft **duplicate set-records** (legacy + nieuwe seeding met dezelfde naam). Order DB sets **`{ cards: { _count: "desc" }}`** in mapping-script zodat sets met cards eerste claim krijgen op een pokewalletId. Anders blijven de echte sets unmapped.

### Mapping-strategie in code
```ts
// 1. Manual override (in MANUAL_SET_MAPPING)
// 2. Naam-match (genormaliseerd, prefer lang=eng)
// 3. Set-code match
// Skip duplicates: track usedPwIds set
```

### normalizeName regex (cruciaal!)
```ts
.replace(/^[a-z]+\d*[a-z]?[:_]\s*(pokemon\s+card\s+)?/i, "")
```
Strip prefix patterns als "SV1:", "SWSH9_", "SV:", "ME:", "SV2a_ Pokemon Card ".
**Digits zijn OPTIONEEL** — pokewallet gebruikt "SV:" voor sub-sets zoals Paldean Fates.

## Sync-robustness (sync.ts)

### Unique-constraint op pokewalletId
2 DB-cards kunnen dezelfde pokewallet card claimen (bv. door duplicate set-rows of name-collisions). **Fix:** check `claimedPwIds` set vóór update, **skip pokewalletId-update als al geclaimd** maar pas wel de pricing toe (zelfde CM-product = zelfde pricing).

```ts
const pwIdAlreadyClaimed = claimedPwIds.has(pw.id);
prisma.card.update({
  data: pwIdAlreadyClaimed ? pricing : { pokewalletId: pw.id, ...pricing },
})
```

### SQLite lock-contention
Met >5 sets sequentieel én **dev-server live** kan SQLite locked raken (`SQLITE_BUSY` of libsql `SocketTimeout` / `P1008`). **Fix in twee lagen:**

1. Batched transactions van 25 in `prisma.$transaction([])`, combineer card.update + cardPriceHistory.upsert in één transactie.
2. `withRetry()` wrapper rond elke DB-call (vind in `src/lib/pokewallet/sync.ts`): exponential backoff 250ms → 4s, max 6 pogingen, alleen bij lock-errors.

**Belangrijk:** PrismaPromise objecten kunnen NIET hergebruikt worden binnen een retry. Sla daarom *raw data* op (geen pre-built queries) en bouw queries opnieuw binnen elke retry-callback.

```ts
// FOUT — failt na eerste timeout
const ops = data.map(d => prisma.card.update({...}));
await withRetry(() => prisma.$transaction(ops));

// GOED — bouwt queries elke poging opnieuw
await withRetry(() => prisma.$transaction(
  data.map(d => prisma.card.update({...}))
));
```

### Brand-new sets fallback
PokeWallet's `/search?q=<set_id>` geeft **0 results voor brand-nieuwe sets** (search-index loopt 1-3 weken achter, bv. Perfect Order me03 op release-week). **Fix:** `fetchSetViaCardLookup()` in client.ts gebruikt `/sets/{id}` om card-IDs op te halen, dan `/cards/{id}` per kaart voor pricing. Kost N+1 calls i.p.v. 1, maar werkt voor freshly-released sets.

## DB-state check commands

```ts
// Hoeveel cards hebben PokeWallet pricing?
const stats = await prisma.card.count({ where: { pokewalletId: { not: null }}});

// Welke cards in mapped sets ontbreken pwId? (matching-issues)
await prisma.card.findMany({
  where: { pokewalletId: null, cardSet: { pokewalletSetId: { not: null }}},
  select: { id: true, name: true, localId: true }
});

// Top sets met meeste unmatched cards (voor debugging)
SELECT cs.name, COUNT(*) as unmatched
FROM Card c JOIN CardSet cs ON c.cardSetId = cs.id
WHERE c.pokewalletId IS NULL AND cs.pokewalletSetId IS NOT NULL
GROUP BY cs.id ORDER BY unmatched DESC LIMIT 10;
```

## Cron-automation

`vercel.json` heeft `0 4 * * *` daily sync naar `/api/cron/sync-pokewallet`. Na elke deploy draait de sync zelfstandig elke nacht. Volledige refresh duurt ~4 minuten (135 sets × ~1.7s).

**Budget-vuistregels (geverifieerd 2026-04-19):**
- Hele DB refresh via `/search?q=<set_id>&limit=100`: ~600 calls (1,2% budget) — BB had 4 calls voor 342 cards
- ⚠️ NIET via `/sets/:setCode` — dat endpoint geeft GEEN prices terug (lege arrays)
- On-demand single via `/cards/{id}`: 1 per page-view — verwaarloosbaar
- Met deze budgetten kan elke 4 uur een volle refresh (3.600 calls/dag, 7,2% budget)

## Endpoints

### Hoofd-endpoints (free tier, dagelijks gebruik)

#### `GET /sets`
Lijst alle Pokémon-sets — eenmalig + 1×/week om mapping te updaten.

```bash
curl -H "X-API-Key: $KEY" "https://api.pokewallet.io/sets"
```

**Response:** `{ success: true, data: [...], total: 150 }`. Per set: `name`, `set_code` (string|null), `set_id` (numeric string), `card_count`, `language`, `release_date`.

**Belangrijk:** `set_code` kan `null` zijn voor promos. `set_id` is altijd uniek en stabiel — gebruik die als canonical join key.

#### `GET /sets/:setCode`
Set details + paginated cards — **METADATA ONLY**, geen prices.

```bash
curl -H "X-API-Key: $KEY" "https://api.pokewallet.io/sets/24325?limit=200&page=1"
```

**⚠️ KRITISCHE VALKUIL (geverifieerd 2026-04-19):** dit endpoint geeft `tcgplayer.prices: []` en `cardmarket.prices: []` voor ALLE cards. Alleen `card_info`, IDs en URLs zijn gevuld. **NIET geschikt voor bulk-pricing-refresh.** Wel handig voor: card-mapping (pk_xxx ID → onze Card.id), card_info refresh, of nieuwe-kaarten detectie.

**Parameters:**
- `setCode` (path): set_code óf numeric set_id (set_id altijd preferred — geen disambiguation nodig)
- `page` (default 1), `limit` (default 50, **max 200**)
- `language` (alleen nodig bij set_code-conflicten)

**Response:** `{ success: true, set: {...}, cards: [...] }`. Pricing arrays altijd leeg.

**Disambiguation:** bij set_code-conflicten retourneert hij `disambiguation: true` met `matches[]`. Wij gebruiken altijd set_id om dit te vermijden.

#### `GET /search?q=<set_id>&limit=100` ⭐ HOOFD-ENDPOINT VOOR BULK PRICING
**Dit is de échte bulk-endpoint** — search met set_id als query geeft alle cards van die set MET volledige pricing.

```bash
curl -H "X-API-Key: $KEY" "https://api.pokewallet.io/search?q=24325&limit=100&page=1"
```

**Verified gedrag (2026-04-19, BB test):**
- `q=24325` filtert alle Black Bolt cards (set_id 24325)
- 100% van returned cards heeft `cardmarket.prices` + `tcgplayer.prices` gevuld
- Returned 342 cards voor BB (vs 188 in `/sets`-endpoint — search inclusief variants/sealed/extra products)
- Pagination: 4 calls (limit max 100) voor hele BB

**Per-set call-budget vuistregel:** `Math.ceil(total_cards / 100)` calls per set. Voor 150 sets ≈ 600 calls per full DB refresh (1.2% van Pro tier).

#### `GET /cards/:id`
Single card lookup — voor on-demand refresh of als gebruiker een specifieke kaart bekijkt.

```bash
curl -H "X-API-Key: $KEY" "https://api.pokewallet.io/cards/pk_xxx"
```

**Parameters:**
- `id` (path): pokewallet card ID. Twee formaten:
  - **TCG cards**: `pk_<hash>` (met prefix)
  - **CardMarket-only**: pure hex hash (zonder prefix)
- `set_code` (optional, query): voor disambiguation

#### `GET /search`
Naam/code/nummer search — voor zoek-functionaliteit op de site, NIET voor bulk-sync.

```bash
curl -H "X-API-Key: $KEY" "https://api.pokewallet.io/search?q=Klink&limit=100"
```

**Parameters:**
- `q` (required): meerdere formaten:
  - Card name: `charizard ex`
  - Set code: `SV2a`
  - Card number: `148` of `148/165`
  - **Precise lookup**: `<set_id> <card_number>` — bv. `q=24541 148`
- `page` (default 1)
- `limit` (default 20, **max 100**) — let op: lager dan /sets endpoint

### PRO endpoints (in onze tier inbegrepen)

#### `GET /sets/:setCode/statistics`
Set-niveau prijsstatistieken: avg/min/max + duurste kaart + 7d trend + rarity breakdown. **Cachen, refresh 1×/dag per set.**

```ts
// Use case: toon op /kaart-database/[setSlug] pagina
// "Gemiddelde prijs: €2,34 | Duurste: Charizard ex €307 | 7d trend: ↑"
```

Optionele `variant=normal|holo` param om alleen die variant te aggregaten.

#### `GET /sets/trending`
Top sets met grootste prijsbeweging laatste 7 of 30 dagen, inclusief top movers per set.

```bash
curl -H "X-API-Key: $KEY" "https://api.pokewallet.io/sets/trending?period=7d&limit=10"
```

**Use case:** homepage "🔥 Trending sets deze week" sectie. Refresh 1×/uur.

#### `GET /sets/:setCode/completion-value`
Geschatte kosten om hele set te completen (low/avg/trend). Per rarity breakdown. Aparte schatting voor TCGPlayer (USD) en CardMarket (EUR) — geen cross-currency conversion.

**Use case:** premium feature voor collectors op set-pagina. On-demand.

**404** retourneert hij voor CardMarket-only sets (negatieve set_id).

### Niet gebruikt
- `GET /sets/:setCode/image` — wij gebruiken TCGdex set-logos die we al hebben

## Data structuur — Card response

```jsonc
{
  "id": "pk_4687f4c4a04...",  // pokewallet ID — pk_xxx of hex
  "card_info": {
    "name": "Klink",
    "clean_name": "Klink",
    "set_name": "SV: Black Bolt",
    "set_code": "BLK",
    "set_id": "24325",          // numeric, canonical
    "card_number": "139/086",   // includes total — gebruik split('/')[0] voor pure number
    "rarity": "Illustration Rare",
    "card_type": "Metal",
    "hp": "60.0",
    "stage": "Basic",
    "card_text": null,
    "attacks": ["[M] Hard Gears (10)<br>..."],
    "weakness": "Rx2",
    "resistance": "G-30",
    "retreat_cost": "1.0"
  },
  "tcgplayer": {
    "url": "https://www.tcgplayer.com/product/642261",
    "prices": [
      {
        "sub_type_name": "Normal",         // "Normal" | "Holofoil" | "Reverse Holofoil"
        "low_price": 4.93,
        "mid_price": 5.80,
        "high_price": 62.50,
        "market_price": 5.26,
        "direct_low_price": null,
        "updated_at": "2026-04-19T06:25:00.662298"  // ISO timestamp
      }
    ]
  },
  "cardmarket": {
    "product_name": "Klink (BLK 139)",
    "product_url": "https://www.cardmarket.com/...",
    "prices": [
      {
        "variant_type": "normal",          // "normal" of "holo" (= REVERSE HOLO!)
        "avg": 4.52,
        "low": 2.90,
        "avg1": 5.37,                      // 1-day avg
        "avg7": 5.31,
        "avg30": 4.84,
        "trend": 5.54,
        "updated_at": "2026-04-19T06:04:26.323476"
      }
    ]
  }
}
```

### Cruciale parsing-regels

1. **`cardmarket.prices[].variant_type === "holo"` = REVERSE HOLO** (NIET de holofoil rare-rarity!). Onze `priceReverseAvg/Low/Trend/Avg7/Avg30` mappen op deze variant.
2. **`cardmarket.prices[].variant_type === "normal"`** mapt op onze `priceAvg/Low/Trend/Avg7/Avg30`.
3. **`tcgplayer.prices[].sub_type_name === "Reverse Holofoil"`** is de TCGPlayer-RH (apart van CardMarket-RH).
4. Voor IR/SIR/UR-kaarten: `holo` variant heeft vaak `avg: null, trend: 0` — dat is correct (deze rarities hebben geen RH-printing).
5. **`tcgplayer` of `cardmarket` kan `null` zijn** als die source de kaart niet heeft. Altijd null-check.
6. **`card_number`** kan zijn:
   - `"139"` (gewoon nummer)
   - `"139/086"` (met total, alleen bij sommige cards) — split op `/`
   - `"GG69"` (gallery-prefix)
   - `null` (sealed products zoals mini-tins)

### Variant-handling: Master/Poke Ball patterns

PokeWallet retourneert Master Ball / Poke Ball Pattern variants als **aparte cards** met eigen `pk_xxx` ID maar zelfde `set_code` + `card_number`:

```
"Klink"                        → pk_da3ecc2... (regular IR)
"Klink (Master Ball Pattern)"  → pk_8b8622... (apart record)
"Klink (Poke Ball Pattern)"    → pk_f8dd85... (apart record)
```

**Onze keuze:** behoud 1 Card-row per (set, card_number) in onze DB om Auction/Listing/Claimsale-relaties simpel te houden. Variant-prijzen gaan in `Card.extraVariantsJson` (al bestaand). Detect varianten in pokewallet-response via `name` regex `/\((.*Pattern.*)\)/`.

### Sealed products

Mini-tins en sealed verschijnen ook in pokewallet (`set_code` matched de set, `card_number: null`, `attacks: []`). **Skip deze in onze sync** tenzij we de Sealed Products feature uitwerken (toekomstig).

## Onze project-architectuur

### File structure
```
src/lib/pokewallet/
├── client.ts          # Authenticated fetcher + rate limiting
├── types.ts           # PokewalletCard, PokewalletSet response types
├── set-mapping.ts     # TCGdexSetId ↔ pokewalletSetId lookups
├── pricing.ts         # Map pokewallet response → onze Card schema
├── bulk-refresh.ts    # Per-set refresher (gebruikt /sets/:id endpoint)
└── single-refresh.ts  # On-demand single card via /cards/:id
```

### DB-schema wijzigingen

**`Card` model** (nieuwe kolommen):
```prisma
pokewalletId            String?  @unique  // "pk_xxx" of hex hash
priceTcgplayerNormalLow      Float?
priceTcgplayerNormalMid      Float?
priceTcgplayerNormalMarket   Float?
priceTcgplayerHoloMarket     Float?       // voor cards met dedicated holo
priceTcgplayerReverseMarket  Float?       // de reverse-holo variant
priceTcgplayerUpdatedAt      DateTime?
```

**`CardSet` model**:
```prisma
pokewalletSetId    String?  @unique  // numeric, bv. "24325"
pokewalletSetCode  String?           // "BLK", kan null
```

**Bestaande kolommen** (`priceAvg`, `priceLow`, etc.) blijven — gemapt vanaf pokewallet's CardMarket data. Geen breaking changes downstream.

### Sync-strategie (geverifieerd 2026-04-19 op BB-test)

```
EENMALIG bij eerste setup (~5 calls):
  1. GET /sets → bouw mapping in DB (CardSet.pokewalletSetId)
  2. Manuele review: zijn alle 150+ sets correct gematched?

DAGELIJKS (cron, ~600 calls):
  Voor elke CardSet met pokewalletSetId:
    page = 1
    while (true):
      GET /search?q={pokewalletSetId}&limit=100&page={page}
      voor elke card in response.results:
        - skip als naam matched /\(.*Pattern.*\)/ → variant (apart in extraVariantsJson)
        - skip als card_number == null → sealed product
        - upsert Card (match op (cardSetId, card_number) of pokewalletId)
        - parse cardmarket.prices: variant_type=normal → priceAvg/Low/Trend/Avg7/Avg30
        - parse cardmarket.prices: variant_type=holo  → priceReverseAvg/Low/Trend/Avg7/Avg30
        - parse tcgplayer.prices: per sub_type_name → priceTcgplayer*
        - snapshot CardPriceHistory voor vandaag
      if (page >= response.pagination.total_pages): break
      page++

ON-DEMAND (per kaart-page-view, na cache miss):
  GET /cards/{Card.pokewalletId}
  update Card pricing-velden

PRO FEATURES (asynchroon):
  - SetStatistics: 1×/dag /sets/:id/statistics → SetStatistics tabel
  - TrendingSets: 1×/uur /sets/trending → TrendingSet cache
  - CompletionValue: on-demand bij premium feature aanvraag
```

### Card matching strategie

Pokewallet kan **meerdere records met dezelfde card_number** retourneren (verschillende CardMarket producten). Bij matching:

```ts
// 1. Group PW results by normalized card_number
const pwByNum = new Map<string, PwCard[]>();

// 2. For each DB card, find matching PW candidates
for (const dbCard of dbCards) {
  const num = normalizeNum(dbCard.localId);  // strip "/086" suffix + leading zeros
  const candidates = pwByNum.get(num) ?? [];

  // 3. Prefer exact name match WITH cardmarket prices
  let pw = candidates.find(c =>
    c.card_info.name === dbCard.name &&
    c.cardmarket?.prices?.length
  );

  // 4. Fallback: any candidate with cardmarket data
  if (!pw) pw = candidates.find(c => c.cardmarket?.prices?.length);

  // 5. Last resort: first candidate (may have no prices)
  pw ??= candidates[0];
}
```

**Let op:** Klink #139 in BB heet `"Klink - 139/086"` in pokewallet (NIET `"Klink"`), dus exact-name-match faalt voor sommige IRs. Voeg substring-match toe als naam de card_number bevat: `c.card_info.name.includes(num)` als alternatieve match.

### Wat we behouden van TCGdex
- **Card images** (TCGdex CDN is gratis en betrouwbaar)
- **Gameplay-fallback** als pokewallet's `card_info.attacks` ooit gaten heeft (zeldzaam)
- **Reverse-holo fallback** (alleen als pokewallet down is)

### Wat verdwijnt
- ❌ pokemontcg.io resolver (`src/lib/tcgdex/ptcgio.ts`) — kan weg
- ❌ tcggo (was niet eens geactiveerd)
- ❌ PriceCharting variants scrape (`src/lib/tcgdex/pricecharting-variants.ts`) — pokewallet doet variants beter
- 🟡 PriceCharting Ungraded (`src/lib/tcgdex/pricecharting-base.ts`) — behouden voor cards >€250 als sanity-check (optioneel)

## Bekende test-cases voor regressie-detectie

Bewaar deze fixtures voor automated tests:

```ts
// tests/fixtures/pokewallet-known-cards.ts
export const KNOWN_CARDS = {
  // De originele bug-kaart — was €14,31, moet ~€4,52 zijn
  klinkBB139: {
    pokewalletId: "pk_da3ecc2705c457452649444b043b74993f43ef89ab38bad90cba0b43ca5d15406127b2b41d473eb383778f15524f1f50",
    expectedAvg: 4.52,  // ±20%
    expectedHasReverseHolo: false,  // IR's hebben geen RH
  },
  // Common BB met RH om te valideren dat we RH correct parsen
  klinkBB061: {
    expectedNormalAvg: 0.03,
    expectedReverseHoloAvg: 0.12,  // CardMarket variant_type=holo
    expectedHasReverseHolo: true,
  },
  // Master Ball variant — apart pokewallet record
  klinkBB061MasterBall: {
    expectedTcgPlayerMarket: 1.58,  // USD
  },
};
```

## Edge cases & valkuilen

1. **`tcgplayer: null`** — kaart bestaat alleen op CardMarket (vaak Japanse sets, oude promos). Skip TCGPlayer-velden.
2. **`cardmarket: null`** — kaart alleen op TCGPlayer. Skip CardMarket-velden.
3. **`cardmarket.prices: []`** — product bestaat maar geen sales-data. Behandel als null.
4. **`avg: null, trend: 0`** voor `holo` variant op IR/SIR/UR — correct (geen RH bestaat). Sla niet op als €0!
5. **Disambiguation response** — alleen relevant bij `set_code` lookup. Bij `set_id` nooit. Wij gebruiken altijd set_id.
6. **`set_id` met negatief teken** (`"-15"`) = CardMarket-only set. `/completion-value` retourneert 404.
7. **Master/Poke Ball patterns** — zelfde card_number maar verschillend `pk_xxx`. Match op `pokewalletId`, niet op `(set, card_number)`.
8. **Mini-tins / sealed** — `card_number: null`. Skip in card-sync, of behandel apart als sealed product.
9. **Updated_at timestamps** — verschillend per CardMarket en TCGPlayer (verschillende scrape-momenten). Bewaar beide afzonderlijk als je freshness wilt tracken.
10. **`card_text` met HTML** — `<br>`, `<strong>`, `<em>` etc. zitten erin. Sanitize voor display of behoud raw met dangerouslySetInnerHTML in een veilige context.
11. **`cardmarket_id: null` in pokewallet response** — pokewallet heeft geen CardMarket linking voor die kaart. Vaak voor 151 commons. Gevolg: de avg-data die wel in response staat is corrupt (wijst naar een ander product). **Onze Marktprijs-formule corrigeert dit automatisch via de extreme-discrepancy check (>5× TP).**
12. **Naam-pattern voor Special Arts**: pokewallet labelt secret rares als `"Klink - 139/086"` (met card_number suffix in name) i.p.v. plain `"Klink"`. Onze matching gebruikt `c.card_info.name.includes(num)` als fallback voor exact-name-match.
13. **GEEN image-URL veld** in pokewallet response. Top-level keys zijn alleen `id, card_info, tcgplayer, cardmarket`. Voor images blijven we TCGdex CDN gebruiken (URLs al in DB).

## Wat NIET in pokewallet zit

- **Per-land EU prijzen** (DE/FR/ES/IT lows) — alleen tcggo had dat. Niet kritisch.
- **Graded prijzen** (PSA/BGS/CGC) — alleen tcggo had dat. Niet kritisch.
- **Card images** — gebruik TCGdex CDN.

## Snel-start commando's voor debugging

```bash
# Test de API key werkt
curl -H "X-API-Key: $POKEWALLET_API_KEY" "https://api.pokewallet.io/sets" | jq '.total'

# Check een specifieke kaart (bv. Klink BB #139 bug-kaart)
curl -H "X-API-Key: $POKEWALLET_API_KEY" \
  "https://api.pokewallet.io/search?q=24325%20139" | jq '.results[0].cardmarket.prices'

# Bulk hele set ophalen
curl -H "X-API-Key: $POKEWALLET_API_KEY" \
  "https://api.pokewallet.io/sets/24325?limit=200&page=1" | jq '.cards | length'

# Trending check (Pro feature)
curl -H "X-API-Key: $POKEWALLET_API_KEY" \
  "https://api.pokewallet.io/sets/trending?period=7d&limit=5" | jq '.trending_sets[].set_name'
```

## Werkstroom bij wijzigingen

Wanneer je werkt aan pokewallet-gerelateerde code:

1. **Lees deze skill volledig** — voorkomt het opnieuw uitvogelen van data-shape
2. **Check `src/lib/pokewallet/` voor bestaande resolver** vóór je iets nieuws schrijft
3. **Test met fixtures** uit `tests/fixtures/pokewallet-known-cards.ts` (bovenstaand) om te voorkomen dat je een regression introduceert
4. **Respecteer rate-limiter** — gebruik altijd de wrapper in `client.ts`, nooit `fetch` direct
5. **Snapshot in `CardPriceHistory`** bij elke pricing-update zodat charts blijven werken
6. **Migrations**: schema-wijzigingen via `npx prisma migrate dev --name <descriptive-name>`, NOOIT direct in de DB editen

## Project-context (per 2026-04-19)

- Pokewallet abonnement: **Pro tier** (€20/mnd, 50.000 calls/dag)
- API key zit in `.env.local` als `POKEWALLET_API_KEY`
- Implementatie in **fasen**:
  - **Fase 1** (data-laag): DB-migratie, set-mapping, resolver-skelet
  - **Fase 2** (sync): bulk refresher + bestaande sync-cron ombouwen
  - **Fase 3** (UI): kaart-detail-pagina uitbreiden met per-variant prijzen + RH-blok + sealed-products tab
  - **Fase 4** (PRO features): SetStatistics, TrendingSets, CompletionValue
- TCGdex blijft draaien voor images en als fallback — niet uitschakelen zolang Fase 1-2 niet stabiel is

## Aanverwante bronnen in onze codebase
- Bestaande TCGdex pricing logic (te verving): [src/lib/tcgdex/pricing.ts](../../../src/lib/tcgdex/pricing.ts)
- Bestaande enrich-card resolver: [src/lib/tcgdex/enrich-card.ts](../../../src/lib/tcgdex/enrich-card.ts)
- Bestaande sync cron: [src/app/api/cron/sync-card-prices/route.ts](../../../src/app/api/cron/sync-card-prices/route.ts)
- Schema: [prisma/schema.prisma](../../../prisma/schema.prisma) — `Card`, `CardSet`, `CardPriceHistory` models
