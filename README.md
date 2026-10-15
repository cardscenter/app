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
| `npm test` | Unit-tests (vitest, map `tests/`) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Typecheck (Turbopack typecheckt niet volledig, dus draai dit vóór een push) |

## Feature-flags

De handelsfuncties zijn verborgen achter server-side flags. Ze staan **standaard uit**; alleen de waarde `true` (of `1`/`on`) zet ze aan. Admins zien de functies altijd, zodat er getest kan worden zonder ze voor iedereen aan te zetten.

| Variabele | Verbergt |
|---|---|
| `FEATURE_WALLET` | App-saldo, storten, uitbetalen, bestellingen, verzending, geschillen, abonnementen, Ember en cosmetics, winkelpagina, statistieken |
| `FEATURE_AUCTIONS` | Veilingen, bieden, Live Hub, volglijst (vereist `FEATURE_WALLET`) |
| `FEATURE_CLAIMSALES` | Claimsales en winkelwagen (vereist `FEATURE_WALLET`) |
| `FEATURE_MARKETPLACE` | Marktplaats, voorstellen, bundel-aanbod (vereist `FEATURE_WALLET`) |
| `FEATURE_COMMUNITY_EVENTS` | Door leden ingediende beurzen in heel Europa; uit = alleen winkel-events |

Bij een flag die uit staat: de links verdwijnen uit navigatie, homepage, zoeken, sitemap en meldingen; de pagina's sturen door naar de homepage; de API-routes en server actions weigeren niet-admins; de bijbehorende crons en realtime-kanalen draaien niet. Het overzicht staat op `/dashboard/admin/config`. Code: `src/lib/feature-flags.ts`, `src/lib/feature-routes.ts`, `src/lib/cron-job-flags.ts`.

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

## Mapstructuur

- `src/app/[locale]/` pagina's (nl/en), `src/app/api/` route handlers en crons
- `src/actions/` server actions, `src/lib/` domeinlogica, `src/components/` UI
- `src/messages/` vertalingen, `prisma/` schema en seeds, `scripts/` beheerscripts, `tests/` unit-tests
- `cards-center-bestelapp/` prototype en spec van de bestelapp (bron van waarheid voor Fase 4)
