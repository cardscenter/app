# Cards Center Community Hub

De app van de fysieke Cards Center-winkel (Dubbele Poort 7, Hulst): accounts voor spelers, evenementen met betaalde inschrijving, eten bestellen via tafel-QR, league en stempelkaart, nieuws, en bulk-inkoop van kaarten. De oude marktplaats-functies (claimsales, marktplaats, veilingen, app-saldo) zitten nog in de code maar staan achter feature-flags uit.

Stack: Next.js 16 (App Router), TypeScript, Tailwind v4, Prisma (SQLite lokaal, Turso live), Auth.js v5, next-intl (nl + en). Hosting: Railway, auto-deploy vanaf `main`.

## Lokaal draaien

```bash
npm install
cp .env.example .env        # vul minimaal AUTH_SECRET in
npx prisma db push          # lokale SQLite-database aanmaken
npx prisma db seed          # testaccounts en voorbeelddata
npm run dev                 # http://localhost:3000
```

Testaccounts uit de seed (wachtwoord `Test1234!`): `admin@cardscenter.nl` (admin), `pikachu@test.nl` (speler). Een admin moet eerst 2FA aanzetten via /dashboard/profiel voordat het admin-panel werkt.

Schema wijzigen: pas `prisma/schema.prisma` aan, stop de dev server, en draai `npx prisma db push --accept-data-loss && npx prisma generate`. Zie `CLAUDE.md` voor de live-database (Turso) en de deploy-afspraken.

## Scripts

| Commando | Doet |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Productie-build en -start |
| `npm test` | Unit-tests (vitest, `tests/unit/`) |
| `npm run test:int` | Integratietests op `dev.db` (`tests/integration/`) |
| `npx tsx scripts/seed-shop-events-demo.ts` | Demo-events (dev-only) |
| `npx tsx scripts/seed-community-demo.ts` | Demo-league, stempels en nieuws (dev-only) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Typecheck (Turbopack typecheckt niet volledig, dus draai dit vóór een push) |

## Feature-flags

De handelsfuncties zijn verborgen achter server-side flags. Ze staan **standaard uit**; alleen de waarde `true` (of `1`/`on`) zet ze aan. Uit is uit voor iedereen, ook voor admins (besluit 2026-10-16); zet een flag tijdelijk aan in `.env` om te testen.

| Variabele | Verbergt |
|---|---|
| `FEATURE_WALLET` | App-saldo, storten, uitbetalen, bestellingen, verzending, geschillen, abonnementen, Ember en cosmetics, winkelpagina, statistieken |
| `FEATURE_AUCTIONS` | Veilingen, bieden, Live Hub, volglijst (vereist `FEATURE_WALLET`) |
| `FEATURE_CLAIMSALES` | Claimsales en winkelwagen (vereist `FEATURE_WALLET`) |
| `FEATURE_MARKETPLACE` | Marktplaats, voorstellen, bundel-aanbod (vereist `FEATURE_WALLET`) |
| `FEATURE_COMMUNITY_EVENTS` | Door leden ingediende beurzen in heel Europa; uit = alleen winkel-events |

Bij een flag die uit staat: de links verdwijnen uit navigatie, homepage, zoeken, sitemap en meldingen; de pagina's sturen door naar de homepage; de API-routes en server actions weigeren; de bijbehorende crons en realtime-kanalen draaien niet. Het overzicht staat op `/dashboard/admin/config`. Code: `src/lib/feature-flags.ts`, `src/lib/feature-routes.ts`, `src/lib/cron-job-flags.ts`.

## Omgevingsvariabelen

Zie `.env.example` voor de volledige lijst met uitleg. Verplicht lokaal: `DATABASE_URL` (`file:dev.db`), `AUTH_SECRET`. Verplicht live: ook `AUTH_TRUST_HOST`, `NEXTAUTH_URL`, `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`, de Turso- en R2-variabelen. Optioneel: `EMAIL_PROVIDER` + `RESEND_API_KEY`, `ANTHROPIC_API_KEY` (foto-moderatie), `POKEWALLET_API_KEY` (kaartprijzen). Geheimen alleen via omgevingsvariabelen, nooit in de code.

## Rollen

- **Speler** (`role` PLAYER): gewone gebruiker. Registreert met e-mail en wachtwoord, kan daarna ook inloggen met een inloglink per e-mail.
- **Staff** (`role` STAFF): mag inchecken bij evenementen, bestellingen en bulk-aanvragen verwerken. Een admin zet de rol op de gebruikerspagina in het admin-panel.
- **Admin** (`accountType` ADMIN): volledig beheer via `/dashboard/admin/*`, ziet ook de verborgen functies. Vereist 2FA.

## Accounts en privacy

- Geboortedatum is verplicht bij registratie en nooit publiek; alleen de leeftijdsdivisie wordt gebruikt.
- Onder de 16: een ouder of verzorger moet per e-mail toestemming geven voordat het account evenementen kan boeken (`/ouder-toestemming`).
- Nieuwsbrief is een losse opt-in die standaard uit staat; afmelden kan met één klik.
- Gebruikers kunnen hun account zelf verwijderen (Instellingen). De rij blijft geanonimiseerd bestaan; inloggen is daarna onmogelijk.
- Welke spellen gekozen kunnen worden (en welk spelers-ID erbij hoort) beheert een admin op `/dashboard/admin/games`.

## Winkel-events en tickets

- Publiek: `/evenementen` (lijst per maand of maandkalender, filters op spel en type) en `/evenementen/[id]` met inschrijfpaneel. Alle events vinden plaats in de winkel (adres in `src/lib/platform-config.ts`, `PLATFORM.shop`).
- Inschrijven: gratis event = direct een ticket; betaald event = plek 10 minuten vastgezet, betalen via Mollie (iDEAL), ticket zodra de betaling binnen is. Vol = wachtlijst; komt er een plek vrij, dan krijgt de eerste op de wachtlijst 24 uur om te betalen of te bevestigen.
- Eisen: e-mail bevestigd, geboortedatum ingevuld, onder de 16 ouder-toestemming, onder de 12 alleen met begeleiding (vinkje). Leeftijdsdivisies per event-type op geboortejaar.
- Tickets: `/dashboard/tickets` met QR (HMAC-gesigneerd), ticketcode `CC-XXXXXX`, agenda-export, zelf annuleren tot X uur vooraf met automatische terugbetaling.
- Staff: `/dashboard/staff/check-in` (camera-scanner via BarcodeDetector of code intypen, deelnemerslijst, CSV-export). Admin: `/dashboard/admin/events` (aanmaken, publiceren, annuleren met terugbetaling, afronden, dupliceren, handmatig toevoegen), `/dashboard/admin/event-types` (divisies, standaardprijs/capaciteit), `/dashboard/admin/hub-settings` (pand-maximum, openingstijden, annuleringsbeleid).
- Mollie: `MOLLIE_API_KEY` leeg = simulatiemodus (checkout vervangen door `/betalen/simuleer/<id>` met knoppen geslaagd/mislukt). Met een `test_`-key gebruikt de app de Mollie test-checkout; de webhook `/api/mollie/webhook` vereist dan een publieke `NEXT_PUBLIC_SITE_URL`. Lokaal haalt de bedankt-pagina de status ook direct bij Mollie op.
- Demo-events lokaal: `npx tsx scripts/seed-shop-events-demo.ts`. Integratietest van de hele flow: `npm run test:int` (tegen `dev.db`).

## Eten bestellen (tafel-QR en bar-QR)

- Gasten scannen de QR op hun tafel (`/bestellen?tafel=7`, tafel 1 t/m 16) of aan de bar (`/bestellen?modus=bar`, naam invullen) en bestellen met hun eigen telefoon. Geen account nodig; de statuspagina werkt met een gast-token in de link. Ingelogd = bestelgeschiedenis op `/dashboard/bestellingen`.
- Flow uit de spec in `cards-center-bestelapp/`: welkom, doorlopend menu met meescrollende categoriebalk, upsell in stappen (friet, gratis eerste saus, drankje met korting), winkelmand met losse menu-onderdelen en menuvoordeel, besteloverzicht met opmerking, betalen (Mollie of aan de bar, fooi, kortingscode), bevestiging met aftelbalk en live status.
- Regels: minstens één eten-item (alleen drinken haal je aan de bar), uitverkochte items blokkeren, geen annuleren na plaatsen. De server rekent prijzen, menuvoordeel en kortingscodes zelf uit (`src/lib/food/pricing.ts`); het bedrag van de telefoon wordt nooit vertrouwd.
- Betalen: online bestellingen komen pas in de keuken als de betaling binnen is (webhook of simulatie); barbestellingen komen direct binnen en starten na "Markeer betaald". Onbetaalde online bestellingen vervallen na 30 minuten.
- Keuken & bar: `/keuken` (alleen staff/admin), tablet-scherm met kolommen Nieuw, In bereiding, Klaar; wachttijd voor gasten (15 tot 60 min), uitverkocht per product, geluid bij een nieuwe bestelling, scherm aan houden, dagoverzicht. Pollt elke 5 seconden.
- Admin: `/dashboard/admin/menu` (prijzen, aan/uit, uitverkocht, teksten, kortingscodes) en `/dashboard/admin/qr-codes` (printbare tafelkaartjes). Menu en codes worden bij de eerste start geseed uit `src/lib/food/menu-data.ts`.

## League, stempelkaart, spaarpunten, nieuws en info

- **League** (`/league`): admin maakt een seizoen aan met puntenregels (winst/gelijk/verlies plus een bonus per gespeeld event); één seizoen tegelijk actief. Staff voert na elk event per deelnemer winst/verlies/gelijk in op `/dashboard/staff/league` (deelnemers met ticket staan er al, anderen voeg je toe). De ranglijst is de som per seizoen; spelers met "toon mij op ranglijsten" uit staan niet publiek maar zien zichzelf wel in `/dashboard/league`.
- **Badges** ("poorten van Hulst", placeholder-namen): drempels per criterium (punten/events/winst in een seizoen, events of stempels totaal), beheer op `/dashboard/admin/league`. Automatisch toegekend bij een uitslag of stempel, met melding; zichtbaar op het spelersprofiel.
- **Stempelkaart en spaarpunten**: elke check-in op een event met "telt mee voor de stempelkaart" geeft een stempel en spaarpunten (aantallen in de winkel-instellingen). Volle kaart = beloning aan de bar plus bonuspunten. Staff geeft handmatig stempels/punten of wisselt punten in op `/dashboard/staff/spaarkaart`. Nooit geld; saldo kan niet onder nul.
- **Nieuws** (`/nieuws`): admin schrijft berichten (concept/gepubliceerd, vastpinnen, omslagfoto) op `/dashboard/admin/news` en stuurt een gepubliceerd bericht één keer als nieuwsbrief naar leden met opt-in en geverifieerd e-mailadres (afmeldlink in elke mail).
- **Info** (`/info`): adres, openingstijden, bereikbaarheid en huisregels; teksten in `/dashboard/admin/hub-settings`.
- **Moderatie**: interne notitie per gebruiker (alleen admins) op de admin-gebruikerspagina; schorsen bestond al.
- **Homepage**: zolang geen handel-flag aan staat toont `/` de hub-startpagina (events, nieuws, league-top-5, praktische info).

## Mapstructuur

- `src/app/[locale]/` pagina's (nl/en), `src/app/api/` route handlers en crons
- `src/actions/` server actions, `src/lib/` domeinlogica, `src/components/` UI
- `src/messages/` vertalingen, `prisma/` schema en seeds, `scripts/` beheerscripts, `tests/` unit-tests
- `cards-center-bestelapp/` prototype en spec van de bestelapp (referentie; geport in Fase 4)
