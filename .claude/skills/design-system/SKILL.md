---
name: design-system
description: Cards Center design-systeem (Ploy-stijl, licht-only). Gebruik dit bij ELKE wijziging aan UI, pagina's, componenten, styling, layout, het dashboard of het admin panel, ook als de gebruiker het niet noemt, zodat alles in de huisstijl gebouwd wordt.
---

# Bouwen in de Cards Center-stijl

1. **Lees eerst `docs/design/DESIGN.md`** (principes, tokens, catalogus van bouwstenen, recepten, verboden lijst). Dat document is leidend; oude stijlregels elders in CLAUDE.md of in oude code zijn vervallen.
2. **Kijk naar de referenties** als je twijfelt hoe iets eruit moet zien:
   - Ploy (de stijlbron): `docs/design/reference/ploy/*.png` + `ploy-analyse.md`
   - Onze eigen pagina's: `docs/design/reference/site/*-desktop.png` en `*-mobiel.png`
3. **Gebruik bestaande bouwstenen**, maak geen eigen kaart-, knop- of veldstijl:
   - publiek: `@/components/ploy` (CenteredHero, Panel, SectionHead, PhaseLadder, FeatureRows, TileQuad, DataCard, CatalogGrid, FaqSection, BannerPromo, ClosingCta, ArticleLayout, AuthFrame, CtaButton, Pill, PunchCard)
   - dashboard: `@/components/dashboard/ui/*` (DashboardPageHeader, DashboardSection, StatCard, DashTile, Callout, EmptyState, StatusBadge, FieldRow, SettingsRow, tones)
   - klasse-constanten: `@/components/ploy/tile-styles` (INPUT, SELECT, LABEL, PILL_BTN(_SM), PILL_RED(_SM), PILL_INK, TABLE_HEAD, CARD, H2, H3)
4. **Check voor je klaar bent**: geen `dark:`, geen `glass*`, geen `rounded-md`/`rounded-lg`-knoppen, geen amber/emerald-tintpillen of -blokken (gebruik StatusBadge/Callout), geen uppercase tabelkoppen, geen `bg-slate-*`; teksten in nl.json + en.json zonder gedachtestreepjes; werkt op 390px breed.
5. **Bekijk het resultaat**: `node scripts/design-screenshots.mjs --url /nl/<pad> --width 1440 --out <scratchpad>/x.png` (en `--width 390`), met `COOKIE=` voor ingelogde pagina's. Na een wijziging in `src/app/globals.css`: controleer dat de dev-server de nieuwe CSS serveert; zo niet, herstart hem met verse `.next`.
6. Nieuwe herbruikbare bouwsteen gemaakt? Voeg hem toe aan de catalogus in `docs/design/DESIGN.md` (en aan `src/components/ploy/index.ts` als het een publieke is).
