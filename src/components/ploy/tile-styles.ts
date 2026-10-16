/**
 * Gedeelde klassen voor kaart-tegels, sorteerknoppen, menu's en zoekvelden in
 * de kaartendatabase, de pokédex en de zoekpagina (design-pass Fase E).
 * Client-importable (alleen strings).
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
export const PILL_RED = "cc-pill inline-flex items-center justify-center gap-1.5 bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-hover)]";
/** Zwarte actie-pil. */
export const PILL_INK = "cc-pill inline-flex items-center justify-center gap-1.5 bg-[var(--foreground)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--foreground)]/85";
/** Uitklapmenu. */
export const MENU = "rounded-[12px] border border-[var(--border)] bg-white shadow-[0_18px_40px_-24px_rgba(32,32,32,0.35)]";
export const MENU_ITEM_ACTIVE = "bg-[var(--pastel-yellow)] font-semibold text-[var(--foreground)]";
/** Groot zoekveld als pil. */
export const SEARCH_INPUT = "cc-pill w-full border border-[var(--border)] bg-white py-3.5 text-base text-[var(--foreground)] transition-colors placeholder:text-[var(--foreground)]/45 focus:border-[var(--foreground)] focus:outline-none";
/** Klein invoerveld. */
export const INPUT = "w-full rounded-[10px] border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] transition-colors placeholder:text-[var(--foreground)]/45 focus:border-[var(--foreground)] focus:outline-none";
/** Sectiekop binnen de catalogus. */
export const H2 = "text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]";
export const H3 = "text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]";
export const MUTED = "text-[var(--foreground)]/55";
