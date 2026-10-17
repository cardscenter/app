/**
 * Gedeelde klassen voor tegels, knoppen, menu's, velden en tabellen, site-breed
 * (begonnen in design-pass Fase E, in ronde G uitgebreid voor het dashboard).
 * Gebruik deze constanten in plaats van eigen `BTN`/`INPUT`-strings per bestand.
 * Client-importable (alleen strings). Zie docs/design/DESIGN.md.
 */
export const SHADOW = "shadow-[0_2px_8px_0_var(--cc-border-subtle)]";
export const SHADOW_HOVER = "hover:shadow-[0_18px_40px_-24px_rgba(32,32,32,0.35)]";
/** Witte tegel met zachte schaduw die bij hover iets omhoog komt. */
export const TILE = `group flex flex-col overflow-hidden rounded-[12px] bg-white ${SHADOW} transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 ${SHADOW_HOVER}`;
/** Witte kaart zonder hover. */
export const CARD = `rounded-[12px] bg-white ${SHADOW}`;
/** Kaartafbeelding-vlak (5:7). */
export const TILE_IMG = "relative aspect-[5/7] bg-[var(--muted)]";
/** Sorteer-/filterknop als witte pil. */
export const PILL_BTN = "cc-pill inline-flex items-center gap-2 border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--background)]";
/** Rode actie-pil. */
export const PILL_RED = "cc-pill cc-grad inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-white";
/** Zwarte actie-pil. */
export const PILL_INK = "cc-pill inline-flex items-center justify-center gap-1.5 bg-[var(--foreground)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--foreground)]/85";
/** Uitklapmenu. */
export const MENU = "rounded-[12px] border border-[var(--border)] bg-white shadow-[0_18px_40px_-24px_rgba(32,32,32,0.35)]";
export const MENU_ITEM_ACTIVE = "bg-[var(--pastel-yellow)] font-semibold text-[var(--foreground)]";
/** Groot zoekveld als pil. */
export const SEARCH_INPUT = "cc-pill w-full border border-[var(--border)] bg-white py-3.5 text-base text-[var(--foreground)] transition-colors placeholder:text-[var(--foreground)]/45 focus:border-[var(--foreground)] focus:outline-none";
/** Klein invoerveld. */
export const INPUT = "w-full rounded-[10px] border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] transition-colors placeholder:text-[var(--foreground)]/45 focus:border-[var(--foreground)] focus:outline-none";
/** Keuzelijst in dezelfde vorm als INPUT. */
export const SELECT = `${INPUT} appearance-auto pr-8`;
/** Meerregelig veld. */
export const TEXTAREA = `${INPUT} min-h-[96px] resize-y leading-relaxed`;
/** Veldlabel. */
export const LABEL = "mb-1.5 block text-sm font-medium text-[var(--foreground)]";
/** Kleine witte pil-knop (secundaire actie in tabellen en kaarten). */
export const PILL_BTN_SM = "cc-pill inline-flex items-center gap-1.5 border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--background)]";
/** Kleine rode pil-knop. */
export const PILL_RED_SM = "cc-pill cc-grad inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white";
/** Tabelkop: rustig, geen hoofdletters. Op `<thead>` of `<tr>`. */
export const TABLE_HEAD = "text-left text-xs font-semibold text-[var(--foreground)]/55";
/** Tabelcel-padding. */
export const TABLE_CELL = "px-4 py-3";
/** Sectiekop binnen de catalogus. */
export const H2 = "text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]";
export const H3 = "text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]";
export const MUTED = "text-[var(--foreground)]/55";
