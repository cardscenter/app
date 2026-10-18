# Cards Center design-systeem

Dé bron voor hoe de site eruitziet en hoe je een nieuwe pagina, sectie of dashboardscherm bouwt. Leidend sinds de design-pass van oktober 2026. **Alles wat hier niet staat en in de code anders oogt, is oude stijl en wordt niet meer nagebouwd.**

- Stijlreferentie: [ploy.ai](https://ploy.ai), screenshots en analyse in [`reference/ploy/`](reference/ploy/).
- Onze eigen pagina's als voorbeeld: [`reference/site/`](reference/site/) (desktop 1440 en mobiel 390).
- Bouwstenen: `src/components/ploy/` (publiek), `src/components/dashboard/ui/` (dashboard), `src/components/community/` (league, stempelkaart, nieuws, spelersprofiel).
- CSS: `src/app/globals.css`, blok "Ploy-primitives" (`.cc-*`) en de tokens in `:root`.
- Screenshots verversen: `node scripts/design-screenshots.mjs` (zie onderaan).

---

## 1. Principes

1. **Licht-only.** `ThemeProvider` staat op `forcedTheme="light"`. Geen `dark:`-varianten meer schrijven. Enige uitzondering: de dashboard-zijbalk draagt zelf `class="dark"`.
2. **Grijze pagina, witte kaarten, gekleurde panelen.** Achtergrond `#f4f4f4`, inhoud op witte kaarten met een zachte schaduw en zonder rand, accenten in grote pastel-panelen met 20px radius.
3. **Grote koppen in Anton** (`.cc-display`: hoofdletters, strakke regelafstand). Alle overige tekst in Geist. Geen andere lettertypes.
4. **Alles is een pil.** Knoppen, tabs, filters, badges en zoekvelden zijn volledig rond (`cc-pill` / `rounded-full`).
5. **Primaire actie = het logo-verloop** (`cc-grad`, donker naar helder rood). Secundair = witte pil met dunne rand, of zwarte pil (`PILL_INK`).
6. **Teksten via i18n** (`src/messages/nl.json` + `en.json`), nooit hardcoded in componenten (admin/staff-pagina's mogen NL hardcoded). **Geen gedachtestreepjes** (— of –) in UI-teksten; gebruik een punt, komma of `·`.
7. **Geen eyebrow-labels boven pagina-koppen** (besluit Youri). Een kleine pil boven een *sectie*-kop (`SectionHead`, `FaqSection`) mag wel.
8. **Beweging is speels maar nooit vereist.** Ballonnen, letter-wiebel, scroll-vulling. Alles werkt zonder hover, met touch en met `prefers-reduced-motion`.

---

## 2. Tokens

| Token | Waarde | Gebruik |
|---|---|---|
| `--background` | `#f4f4f4` | pagina-achtergrond (`bg-background`) |
| `--foreground` / `--cc-ink` | `#202020` | tekst, zwarte pillen, nummer-cirkels |
| `--card` | `#ffffff` | kaarten (`bg-white` mag ook) |
| `--muted` | `#ebebeb` | lege beeldvlakken, rustige vlakken |
| `--muted-foreground` | `#555` | subtekst; vaak ook `text-[var(--foreground)]/55` |
| `--border` | `#e3e3e3` | randen van velden en witte pillen |
| `--primary` | `#a3172a` (hover `#8c1420`) | links en accenten |
| `cc-grad` | `#8c1420 → #b8192a → #e2232f` | primaire knoppen, attentie-badges |
| `--destructive` | `#b91c1c` | verwijderen (anders dan primair rood) |
| `--cc-dark` | `#16090b` | hero, footer, dashboard-zijbalk |
| `--pastel-pink` / `-ink` | `#ffc4ce` / `#7a0f1e` | panelen, tegels, status "probleem" |
| `--pastel-yellow` / `-ink` | `#fff26b` / `#3f2a08` | panelen, tegels, status "let op" |
| `--pastel-blue` / `-light` / `-ink` | `#c9dcff` / `#e9f1ff` / `#0d1b3f` | panelen, info |
| `--pastel-green` / `-ink` | `#d4f58f` / `#253611` | panelen, status "gelukt" |
| `--radius-panel` | `20px` | grote panelen |
| `--radius-dash` | `12px` | kaarten (`dash-card`, `CARD`) |
| `--shadow-card` / `-hover` | `0 2px 8px rgba(32,32,32,.08)` / `0 18px 40px -24px rgba(32,32,32,.35)` | `shadow-card`, `shadow-card-hover` |
| `--site-nav-offset` | `5rem` (md+ `6rem`) | hoogte van de zwevende navigatie; `<main>` heeft dit als padding-top, sticky elementen gebruiken `top-[var(--site-nav-offset)]` |

Utilities: `bg-pastel-pink|yellow|blue|green`, `text-pastel-*-ink`, `cc-pill`, `cc-grad`, `cc-display`, `cc-punch` (+ `<span className="cc-punch-dots" />` als eerste kind voor de onderste twee stippen), `dash-card`.

**Radius-schaal**: pillen rond · velden 10px · kaarten 12px · callouts 14px · gebruikerskaart/zijbalk-onderdelen 16px · panelen 20px. Geen `rounded-md`/`rounded-lg`/`rounded-2xl` meer kiezen.

---

## 3. Typografie

| Rol | Klassen |
|---|---|
| Paginakop (publiek) | `DisplayHeading` size 1-3, of `CenteredHero` |
| Paginakop (dashboard) | `DashboardPageHeader` (`cc-display text-[32px] lg:text-[40px]`) |
| Sectiekop | `SectionHead`, of `H2` = `text-2xl font-semibold tracking-[-0.03em]` |
| Kaartkop | `H3` = `text-lg font-semibold tracking-[-0.03em]` |
| Grote getallen | `cc-display text-3xl tabular-nums` (StatCard, DashTile `display`) |
| Bodytekst | `text-[15px]`/`text-base`, subtekst `text-sm text-muted-foreground` |
| Tabelkop | `TABLE_HEAD` = `text-xs font-semibold text-[var(--foreground)]/55`, **geen** uppercase |

DisplayHeading-maten: 1 = 56→144px, 2 = 44→96px, 3 = 40→64px, 4 = 32→44px.

---

## 4. Layout en breedtes

- **Inhoud**: `max-w-6xl` (1152px), zijpadding `px-4 sm:px-5 lg:px-6`. `PageContainer` default = 6xl, narrow = 3xl, wide = 1400px.
- **Navigatie**: zwevende witte pil (`src/components/layout/site-nav.tsx`), max 1400px, `px-4 lg:px-8`. Het logo staat los van de pillen (2026-10-18): mobiel gecentreerd op knophoogte (h-12), desktop links van de linkspil (h-10). Zodra de pagina meer dan 24px gescrold is veert het omhoog weg (framer-motion, zelfde easing als het footer-logo) en schuift de linkspil naar links; helemaal bovenaan komt het terug. In het mobiele menu is zoeken een loepje dat over de actierij heen uitklapt (`GlobalSearch variant="mobile"`).
- **Panelen**: `<Panel color>` loopt full-bleed met 20px radius, binnenkant op 72rem.
- **Dashboard**: frame `max-w-[1400px] px-4 lg:px-8` (gelijk aan de nav-pil), links een zwevend donker paneel van 248px (`dashboard-shell.tsx`), rechts de inhoud met `space-y-6`.
- **Berichten**: `MessagesFrame` 1400px, schermvullend, zonder zijbalk.
- `/bestellen` en `/keuken` houden bewust de stijl uit de bestelapp-spec.

---

## 5. Bouwstenen

Importeer uit `@/components/ploy` (barrel) of het losse bestand; `StoryRows`, `AuthFrame` en `FooterView` alleen via hun eigen bestand. Alle bouwstenen zijn props-only: de pagina vertaalt.

### Publieke pagina's (`src/components/ploy/`)

| Bouwsteen | Wanneer | Belangrijkste props |
|---|---|---|
| `CenteredHero` | kop van elke publieke pagina | `title`, `highlightWord` + `highlightColor` (veegstreep), `illustration`, `description`, `children` (knoppen/zoekveld), `size` 1-3 |
| `DisplayHeading` | grote kop los | `text`, `size`, `tag`, `scrollFill` (woorden vullen bij scrollen), `children` |
| `Highlight` / `withHighlight` | veegstreep achter één woord, optioneel met uitgeknipte illustratie | `color`, `illustration` |
| `Panel` | gekleurd sectievlak | `color` pink/yellow/blue/green/ink/dark/white, `padding` sm/md/lg |
| `SectionHead` | kop boven een sectie op de grijze achtergrond | `eyebrow`, `title`, `intro`, `action`, `size` 2-4 |
| `PhaseLadder` | "zo werkt het" in stappen | `title`, `intro`, `steps[{title,text}]`, `color` |
| `FeatureRows` | regels, voorwaarden, "goed om te weten" | `title`, `intro`, `rows[{title?,number?,text}]` |
| `TileQuad` | 2 of 3 kolommen pastel-tegels met braille-icoon | `items[{title,text,color,animation?,action?}]`, `columns` |
| `DataCard` | feiten/cijfers in een witte kaart | `badge`, `title`, `tiles[{label,value,hint?}]`, `columns`, `children` |
| `CatalogGrid` | lijst met filterpillen | `filters`, `toolbar`, `children`, `empty` |
| `StoryRows` | genummerde verhaalrijen tekst/beeld | `rows[{number?,title,text,visual?,color?}]` |
| `FaqSection` | vragen, één tegelijk open | `eyebrow`, `title`, `items[{q,a}]`, `defaultOpen` |
| `BannerPromo` | donkere strook met één actie | `eyebrow`, `title`, `text`, `action`, `note` |
| `ClosingCta` | slotpaneel met enorme kop | `title`, `text`, `children`, `color` |
| `TestimonialWall` | ervaringen in kolommen | `items`, `columns` (`**vet**` in quotes) |
| `ArticleLayout` | nieuwsbericht, juridische tekst | `back`, `meta`, `title`, `lead`, `cover`, `children`, `after` |
| `AuthFrame` | login, registratie, wachtwoord, welkom | `width` sm/md/lg/xl |
| `PunchCard` | witte kaart met vier hoekstippen | `dot` (stipkleur), `as` |
| `PromptCard` | code/ticketcode met kopieerknop | `value`, `label`, `tone` light/dark |
| `Pill` | label/badge | `tone` ink/white/pastel, `color` |
| `CtaButton` | grote knop met letter-wiebel | `href` of `onClick`, `variant` red/dark/light/ghost, `icon`; `children` = string |
| `Balloon` / `FloatingBalloon` | decoratie | `color` red/pink/yellow/blue/green, `shape` cloud/flower/stack |
| `Marquee`, `RollingNumber`, `BrailleIcon`, `AudienceAccordion` | homepage-elementen | zie bestand |

**Klasse-constanten** (`src/components/ploy/tile-styles.ts`), gebruik deze in plaats van eigen strings:
`CARD`, `TILE`, `TILE_IMG`, `PILL_BTN`, `PILL_BTN_SM`, `PILL_RED`, `PILL_RED_SM`, `PILL_INK`, `MENU`, `MENU_ITEM_ACTIVE`, `SEARCH_INPUT`, `INPUT`, `SELECT`, `TEXTAREA`, `LABEL`, `TABLE_HEAD`, `TABLE_CELL`, `H2`, `H3`, `MUTED`. Knoppen kunnen ook via `buttonVariants()` uit `src/components/ui/button-variants.ts` (zijn al pillen; default = `cc-grad`).

### Community (`src/components/community/`)
`Podium` (top 3), `StandingsTable` (ranglijst, eigen rij geel), `StampCardVisual` (stempelkaart), `NewsCard` (`featured` = breed), `PlayerProfileHeader`, `LeagueBadgePill`, `ShopMap` (plattegrond van Hulst met routelagen auto/fiets/bus: hover toont, klik zet vast, zachte zoom per route, "Vergroot" opent een lightbox; afbeeldingen `public/images/sections/plattegrond-*.webp`, bronnen via `scripts/convert-webp.mjs`).

### Dashboard (`src/components/dashboard/ui/`)

| Bouwsteen | Wanneer |
|---|---|
| `DashboardPageHeader` | eerste kind van elke dashboardpagina (`title`, `subtitle`, `action`, `back`) |
| `DashboardSection` | witte kaart met kop zonder scheidingslijn; `tone` maakt er een pastel-vlak van; `variant="plain"` voor alleen een kop |
| `StatCard` | KPI met getal in display-letter; `tone` voor de icoon-cirkel |
| `DashTile` | klikbare tegel (label, titel of getal, pijl); op de home en in overzichten |
| `Callout` | infoblok: `tone` yellow = let op, blue = info, pink = probleem, green = gelukt |
| `EmptyState` | lege staat als punch-card met pastel icoon |
| `StatusBadge` | statuspil: success groen, warning geel, danger roze, info blauw, primary inkt, neutral grijs |
| `PageTabs` (`dashboard/page-tabs.tsx`) | tabs als pillen (actief zwart) |
| `SettingsRow`, `FieldRow` | instellingen- en formulierrijen |
| `tones.ts` | `TONE_ICON` / `TONE_SURFACE` voor eigen pastel-vlakken |

De zijbalk (`dashboard-nav.tsx`, `admin/admin-nav.tsx`, `nav-styles.ts`) is bijna-zwart met witte pil voor de actieve rij, `cc-grad` voor attentie-badges en pastel-geel voor de admin-rij.

---

## 6. Recepten

### Publieke pagina
```tsx
<div className="cc-landing overflow-clip">
  <CenteredHero title={t("heroTitle")} highlightWord={t("heroWord")} highlightColor="yellow" description={t("heroText")}>
    <CtaButton href="/evenementen">{t("cta")}</CtaButton>
  </CenteredHero>
  <section className="flex justify-center px-4 pb-16 sm:px-5 lg:px-6">
    <div className="w-full max-w-6xl space-y-16">
      <SectionHead title={t("sectionTitle")} intro={t("sectionIntro")} />
      {/* CatalogGrid / DataCard / TileQuad ... */}
    </div>
  </section>
  <PhaseLadder title={t("howTitle")} steps={steps} color="blue" />
  <FaqSection title={t("faqTitle")} items={faq} />
  <ClosingCta title={t("closingTitle")} color="yellow"><CtaButton href="/register">{t("closingCta")}</CtaButton></ClosingCta>
</div>
```

### Dashboardpagina
```tsx
<div className="space-y-6">
  <DashboardPageHeader title={t("title")} subtitle={t("subtitle")} action={<Link href="/x" className={buttonVariants()}>{t("new")}</Link>} />
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <StatCard label={t("a")} value={12} icon={Ticket} tone="pink" />
  </div>
  <DashboardSection title={t("listTitle")} action={<Link className={PILL_BTN_SM} href="/x">{t("all")}</Link>}>
    {items.length === 0 ? <EmptyState icon={Ticket} title={t("empty")} compact /> : <ul className="space-y-2">…</ul>}
  </DashboardSection>
</div>
```

### Tabel (dashboard/admin)
`dash-card overflow-hidden` → `<table className="w-full text-sm">`, `<thead className={TABLE_HEAD}>` met `bg-[var(--background)]`, cellen `TABLE_CELL`, rijen `divide-y divide-border`, acties als `PILL_BTN_SM`, statussen als `StatusBadge`.

### Formulier
Veld: `<label className={LABEL}>` + `<input className={INPUT} />` (of `SELECT`/`TEXTAREA`); rijen via `FieldRow`; opslaan met `buttonVariants()` of `PILL_RED`; foutmelding als `Callout tone="pink"`, succes `tone="green"`.

---

## 7. Beweging en mobiel

- Niets mag op hover leunen: elke hover-animatie moet ook zonder kunnen.
- Geen `touch-action: none` op grote vlakken (framer `drag` zet dat); sleepbaar alleen bij `(pointer: fine)`.
- Geen `background-clip: text` voor iets dat tijdens scrollen verandert (iOS Safari tekent het niet opnieuw); gebruik een overlay met `clip-path` zoals `.cc-word-fill`.
- Geen `backdrop-blur` boven bewegende panelen.
- Intervallen alleen laten lopen als het element in beeld is (IntersectionObserver, zie `BrailleIcon`).
- Altijd `prefers-reduced-motion` respecteren (`useReducedMotion` of de media query in globals.css).
- Telefoon testen: `http://<laptop-ip>:3000`, het IP moet in `allowedDevOrigins` (`next.config.ts`) staan.

---

## 8. Niet meer gebruiken (oude stijl)

| Niet | Wel |
|---|---|
| `glass`, `glass-subtle`, `glass-nav`, `glass-input` (bestaan nog als vangnet) | `dash-card` / `CARD`, `INPUT` |
| `dark:`-varianten | niets (licht-only) |
| `rounded-md`/`rounded-lg bg-primary`-knoppen | `buttonVariants()`, `PILL_RED`, `cc-pill cc-grad` |
| `bg-amber-50 border-amber-200`, `bg-blue-50`, `bg-red-50`-blokken | `Callout` |
| `bg-emerald-500/10 text-emerald-700`-statuspillen | `StatusBadge` |
| `uppercase tracking-wider` tabelkoppen en labels | `TABLE_HEAD`, gewone zinnen |
| `bg-slate-*`, `text-slate-*`, `bg-gray-*` | tokens (`foreground`, `muted`, `background`) |
| `shadow-sm/md/lg` op kaarten, `rounded-2xl border border-border bg-card shadow-card` | `dash-card` |
| eigen `max-w-*` in dashboardpagina's | het frame regelt de breedte |
| TailAdmin-navy en -blauw (`#1c2434`, `#3b82f6`) | `--cc-dark`, `cc-grad` |
| `src/components/home/*` buiten `landing/` (oude marketing-homepage) | de landing en de ploy-bouwstenen |

---

## 9. Checklist nieuwe pagina

1. Publiek: `CenteredHero` bovenaan, inhoud op `max-w-6xl`, panelen via `Panel`/`PhaseLadder`/`ClosingCta`. Dashboard: `space-y-6` + `DashboardPageHeader`.
2. Alleen bouwstenen en tile-styles-constanten, geen eigen kaart- of knopstijl.
3. Teksten in nl.json en en.json, geen gedachtestreepjes.
4. Geen `dark:`, geen `glass`, geen uppercase-labels.
5. Werkt op 390px breed zonder horizontale scroll; tik-doelen minstens 36px.
6. Screenshot maken (desktop + mobiel) en vergelijken met `reference/site/`.

---

## 10. Screenshots maken

`scripts/design-screenshots.mjs` gebruikt de lokale Chrome via CDP (geen extra packages):

```bash
node scripts/design-screenshots.mjs                       # alle referentiepagina's naar docs/design/reference/site/
node scripts/design-screenshots.mjs --url /nl/league --width 390 --out tmp.png
COOKIE=<authjs.session-token> node scripts/design-screenshots.mjs   # ook de dashboardpagina's
```

Inloggen voor de cookie: `GET /api/auth/csrf` (cookie-jar) → `POST /api/auth/callback/credentials` met `csrfToken`, `email=pikachu@test.nl`, `password=Test1234!`, `json=true`; de waarde van `authjs.session-token` uit de jar is de cookie.

---

## 11. Historie

- **2026-10-16 homepage** (`hub-design-homepage`): landing in Ploy-stijl, `src/components/home/landing/`.
- **Fase A fundament**: tokens, fonts, licht-only, pil-navigatie, nieuwe footer, `src/components/ploy/`.
- **Fase B** events + info · **C** league, nieuws, ervaringen (model `ShopTestimonial`), spelersprofiel · **D** verkopen, juridisch, auth (`AuthFrame`) · **E** kaartendatabase, pokédex, zoeken (`tile-styles.ts`) · **F** dashboard-kaarten, pil-knoppen, berichten, mobiele animatie-fixes.
- **Spaarkaart-blok (2026-10-17)** (`hub-loyalty-block`): het roze homepage-blok gaat over stempelkaart en spaarpunten i.p.v. drie cijferkaarten; `StampCardVisual` toont de stempel-afbeelding in een vaste willekeurige stand per speler (`seed`).
- **Ronde G (2026-10-17)**: glass/schaduw/veldstijl site-breed naar de nieuwe kaarttaal, landing is de enige homepage, zijbalk bijna-zwart met rood, hub-dashboardhome, dashboard-bouwstenen (`DashTile`, `Callout`, `tones.ts`), dit document.
- Niet overgenomen van Ploy: lettertype FK Screamer (betaald, vervangen door Anton), ballon-video's (SVG-ballonnen), de film, de teksten.

---

## 12. Welke pagina gebruikt wat (per fase)

Overzicht uit de design-pass, handig om een bestaande pagina als voorbeeld te nemen.

referentie = https://ploy.ai (analyse + sectiebibliotheek + fase-indeling in `C:\Users\youri\.claude\plans\grote-verandering-van-plannen-harmonic-horizon.md`, sectie "Design-pass"). **Homepage** (branch `hub-design-homepage`): `src/components/home/landing/` (`landing-page.tsx` + data `src/lib/landing-data.ts`; hero met sleepbare ballonnen en `videoSrc`-slot, marquee, pijlers met braille-icoonanimaties, roze spaarkaart-paneel (`LoyaltyPanel` in `loyalty-panel.tsx`: titel met geanimeerde stempel `public/images/sections/stempel.webp`, kaarten `StampCardTile` + `PointsTile` uit `loyalty-cards.tsx`; ingelogd de eigen stempelkaart en het eigen puntensaldo via `landing-data.loyalty`, uitgelogd een voorbeeld), geel activiteiten-paneel (`AnimatePresence mode="popLayout"`), blauw events-paneel met basiliek van Hulst (`public/images/sections/basiliek.webp`, geknipt achter een groene veegstreep op "HULST" via `Highlight`), parallax-woorden, accordeon, CTA). i18n `home.landing`. tags `backup/homepage-pre-design-2026-10-16` en `backup/chrome-pre-foundation`. **Fase A — fundament site-breed** (branch `hub-design-a-fundament`, commits `design-a.*`): zie de bullet **Site-chrome en breedtes** in Conventions. **Fase B — events + info** (branch `hub-design-b-events`, commits `design-b.*`): `/evenementen` (hero met veegstreep op "Hulst" via `CenteredHero highlightWord`, `CatalogGrid` met filterpillen + lijst/kalender-toggle, `EventCatalogCard` punch-cards per maand, `PhaseLadder` "Zo werkt het", `BannerPromo`, `FaqSection`, `ClosingCta`), `/evenementen/[id]` (hero, `DataCard` met feiten naast het `RegistrationPanel` (alleen klassen gewijzigd, flows ongewijzigd), stappenladder in de type-pastel, `FeatureRows` "Goed om te weten", deelnemers-`Panel`, promo-strook), `/bedankt` (`ReturnStatus` als punch-card met `PromptCard`-ticketcode), `/info` (`TileQuad` adres/openingstijden/bereikbaarheid/contact, genummerde `FeatureRows` huisregels, `BannerPromo`, FAQ, `ClosingCta`). Nieuwe bouwstenen in `src/components/ploy/`: `Highlight`/`withHighlight` (veegstreep + geknipte illustratie), `BrailleIcon`, `CenteredHero` (client: roept `withHighlight` aan; **geen eyebrow-pil meer**, besluit Youri: geen kleine labels boven pagina-koppen), `PhaseLadder`, `FeatureRows`, `FaqSection`, `BannerPromo`, `ClosingCta`, `CatalogGrid`, `DataCard`, `PromptCard`, `TileQuad`; `DisplayHeading` kreeg een `children`-slot. Event-type kleuren → pastel via `typePastel()` in `event-type-pill.tsx`. i18n: nieuwe `shopEvents.*`- en `community.info*`-keys. **Fase C — community** (branch `hub-design-c-community`, commits `design-c.*`): nieuw model `ShopTestimonial` (quote met `**vet**`-markering, auteur/rol, bron GOOGLE|INSTAGRAM|DISCORD|IN_STORE|EMAIL|OTHER, kleur, `approved`, `featured`, `sortOrder`; Turso `prisma/turso-design-testimonials.sql`; lib `src/lib/community/testimonials.ts`; admin `/dashboard/admin/testimonials[/id|/nieuw]` met `actions/admin/testimonials.ts` (audit `SAVE_TESTIMONIAL`/`DELETE_TESTIMONIAL`, targetType `TESTIMONIAL`); demo `scripts/seed-testimonials-demo.ts`). Pagina's: `/league` (`CenteredHero`, `Podium` top-3 + `DataCard` met de `StandingsTable` in Ploy-stijl, `PhaseLadder` met de puntenregels van het seizoen, badges als `TileQuad`, geel stempelkaart-paneel met `StampCardVisual`, `FeatureRows`, `ClosingCta`), `/nieuws` (eerste bericht als brede `NewsCard`, rest in `CatalogGrid`, nieuwsbrief-`BannerPromo`), `/nieuws/[slug]` (`ArticleLayout` + verwante kaarten), `/ervaringen` (nieuw: `TestimonialWall` + promo + slot; link in nav/footer/sitemap), spelersprofiel `/spelers/[id]` (`PlayerProfileHeader`: omslag met ballonnen, naam in display-letter, feiten-pillen incl. favoriete spellen, tellers; league-`DataCard` + gegevens-punch-card, poorten als tegels; handel-tabs alleen bij flags; `seller-about-panel.tsx` verwijderd). Homepage toont een ervaringen-rij vanaf drie uitgelichte quotes (`landing-data.testimonials`). Nieuwe bouwstenen: `TestimonialWall`/`renderEmphasis`, `ArticleLayout`, `SectionHead` (ploy) en `Podium`, `StampCardVisual`, `NewsCard`, `PlayerProfileHeader` (community). i18n: `community.*` (league/news/exp/profile-keys), `home.landing.testimonials*`, `common.experiences`, `admin.navTestimonials`. **Let op**: `PunchCard` rendert een stippen-span als eerste kind, dus een grid/flex-layout hoort in een eigen wrapper erbinnen. **Fase D — verkopen, juridisch, auth** (branch `hub-design-d-verkopen-auth`, commits `design-d.*`): `/verkopen` herbouwd (`SellHero` met veegstreep op "Cards Center" + feiten-pillen, `SellPaths` als `TileQuad`, `SellHowItWorks` als `PhaseLadder`, `SellPricingCards` = twee `DataCard`s met rekenvoorbeeld en bulk-tarieven uit de DB, `SellConditions` als genummerde `FeatureRows`, `SellShipping` als groen `Panel` met adres-punch-card, `SellPayout` als tegels, twee `FaqSection`s, `BannerPromo` contact, `ClosingCta`); calculators (`/verkopen/bulk`, `/losse-kaarten`) kregen een compacte `CenteredHero` en alleen klassen-restyle in `bulk-calculator`/`collection-calculator`/`buyback-cart`/`buyback-success`/`payout-method-select`/`buyback-card-search`/`buyback-faq` (flows ongewijzigd); `packing-instructions.tsx` herbouwd (adres-punch-cards, `StoryRows` voor de vijf stappen, tips-tegels, vervoerders-`DataCard`, roze waarschuwingspaneel) en gebruikt op `/verkopen/verpakken` én na een inkoopaanvraag; verkoopovereenkomsten, `/voorwaarden` en `/privacy` in `ArticleLayout` (tekst ongewijzigd), `CompanyIdentity` als licht blok; `/support` met `TileQuad` (mail, winkel, tickets of geschil afhankelijk van `FEATURE_WALLET`, FAQ-links) + voorrang-`BannerPromo`. **Auth**: `src/components/ploy/auth-frame.tsx` (lichte achtergrond met `FloatingBalloon`s + gecentreerde witte punch-card, `width` sm/md/lg/xl) voor login, registratie (stappen als pillen), inloglink, wachtwoord vergeten/reset, e-mailverificatie, `/welkom` en `/ouder-toestemming`; `(auth)/layout.tsx` verbergt alleen nog de footer; koppen in `cc-display`, knoppen via `src/components/auth/auth-styles.ts`; `auth-marketing-aside.tsx` verwijderd (de `auth.aside*`-keys staan nog in nl/en, ongebruikt). Nieuwe bouwstenen: `StoryRows` (genummerde verhaalrijen met pastelvlak), `AuthFrame`. i18n: `buyback.landing.heroWord/pricing*/shippingHeading/faqTitle*/questions*`; gedachtestreepjes uit de `buyback`-strings gehaald. **Fase E — kaartendatabase + zoeken** (branch `hub-design-e-kaarten`, commits `design-e.*`): gedeelde tegel-/knop-/veldklassen in `src/components/ploy/tile-styles.ts` (`TILE`, `CARD`, `PILL_BTN`, `PILL_RED`, `MENU`, `SEARCH_INPUT`, `INPUT`, `H2`/`H3`); `/kaarten` (`CenteredHero` met tellers-pillen, zoekveld als pil, marquee, stijgers/dalers als twee `DataCard`s met rangnummers in de display-letter (`database-trending.tsx` herschreven), pastel-linktegels naar pokédex en inkoop, series met set-tegels), `/kaarten/[set]` (logo op geel vlak, naam in display-letter, pillen, grid), kaartdetail (broodkruimel-pillen, naam in display-letter, feiten als `Pill`s, prijspaneel met ronde periode-/variant-toggles en marktwaarde in `cc-display`, gele verkoop-tegel, speelgegevens-kaarten; **aanbod en recent verkocht alleen bij handel-flags**), `/pokedex` (hero met zoekveld, witte tegels), `/pokedex/[slug]` (`PokedexHeader` met artwork op pastelblauw + display-naam, `PokedexTabs` als pillen), `/zoeken` (hero met zoekveld, `SearchTabs` als pillen, tegels per categorie, lege staat als punch-card). Alle kaart-/pokédex-/zoekcomponenten kregen alleen klassen-restyle (logica ongewijzigd); `ui/pagination.tsx` als pillen. Geen `Breadcrumbs`/`PageContainer` meer op deze pagina's. i18n: `search.heroTitle/heroTitleQuery/heroWord`. **Fase F — dashboard + berichten** (branch `hub-design-f-dashboard`, commits `design-f.*`, laatste fase): `@utility dash-card` is nu een witte kaart met 12px-radius en zachte schaduw zonder rand (`--radius-dash` 0.75rem), waardoor alle speler-, staff- en admin-kaarten in één keer omgingen; `buttonVariants` site-breed als pillen (`rounded-full`, semibold, default h-9/px-4, sm h-8, lg h-11, outline wit); dashboard-primitives: `DashboardPageHeader`-titel in `cc-display`, `DashboardSection` met ruimere kop, `StatCard`-waarde in de display-letter met ronde icoon-tegel, `EmptyState` wit met dikkere stippellijn, `StatusBadge`-tonen als pastelpillen (success groen, warning geel, danger roze, info blauw, primary inkt), `PageTabs` als pillen; sidebar blijft navy maar `NAV_ROW` is `rounded-full`; hamburger als pil; dashboard-home-kop via `DashboardPageHeader`; hardcoded `rounded-md bg-primary …`-knoppen in dashboard/admin/shop-events/community/food via script naar `cc-pill`. **Berichten**: `ChatLayout` als afgeronde witte kaart (`rounded-t-[20px]`, marge zoals de panelen), zoekveld en segment-tabs als pillen, composer met afgerond tekstveld en rode pil-knop, `MessagesFrame` op 1400px. Gedachtestreepjes in de UI-strings (nl/en) zijn vervangen. **Mobiel (2026-10-17, `design-f.mobile-motion`)**: scroll-vulling van `DisplayHeading` loopt via een `.cc-word-fill`-overlay met `clip-path` (geen `background-clip: text` meer: iOS Safari tekende de gradient niet betrouwbaar opnieuw); hero-ballonnen zijn alleen sleepbaar bij `(pointer: fine)` en krijgen op touch `touch-pan-y` zodat een veeg op een ballon gewoon scrolt; `Balloon` heeft een `shadow`-prop (uit in de hero, daar is al een CSS drop-shadow); geen `backdrop-blur` boven bewegende panelen; `CtaButton` wiebelt niet bij `pointerType === "touch"`; `BrailleIcon` tikt alleen in beeld. Bij een nieuwe animatie: niets op hover laten leunen, geen `touch-action: none` op grote vlakken, geen `background-clip: text` voor iets dat tijdens scrollen verandert. De design-pass is hiermee compleet; keuken/bestellen houden bewust de spec-stijl. Niet overgenomen van Ploy: lettertype (FK Screamer, betaald), ballon-video's, film, teksten.
