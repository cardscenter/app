// Gedeelde klassen voor de zwevende pil-navigatie (design-pass 2026-10,
// Ploy-stijl). Eén bron zodat loep, bel, berichten, winkelwagen, admin-schild
// en saldo exact dezelfde ronde icoonknop zijn. Puur bestand — client én
// server mogen 'm importeren.

/** Ronde 40px-icoonknop in de witte pil. */
export const HEADER_ICON_BTN =
  "relative grid size-10 shrink-0 place-items-center rounded-full text-[var(--foreground)]/65 transition-colors hover:bg-[var(--background)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]/35";

/** Amber-variant voor het admin-schild. */
export const HEADER_ICON_BTN_ADMIN =
  "relative grid size-10 shrink-0 place-items-center rounded-full text-amber-700 transition-colors hover:bg-amber-100 hover:text-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40";

/** Zachte schaduw onder elke zwevende pil. */
export const HEADER_PILL_SHADOW = "shadow-[0_8px_30px_-12px_rgba(32,32,32,0.35)]";

/** Rode pil-knop (primaire actie, "Account aanmaken"). */
export const HEADER_PILL_LIGHT =
  `inline-flex h-12 shrink-0 items-center justify-center whitespace-nowrap rounded-full cc-grad px-6 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]/35 ${HEADER_PILL_SHADOW}`;

const HEADER_PILL_GHOST_BASE =
  `inline-flex h-12 shrink-0 items-center gap-2 whitespace-nowrap bg-white text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--background)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]/35 ${HEADER_PILL_SHADOW}`;

/** Witte pil (saldo). */
export const HEADER_PILL_GHOST = `${HEADER_PILL_GHOST_BASE} rounded-full`;

/** Avatar-pil: zelfde witte pil, licht-afgeronde hoeken concentrisch met de
 *  `rounded-[22%]`-avatar (32px → ~7px) plus de padding van de pil. */
export const HEADER_AVATAR_PILL = `${HEADER_PILL_GHOST_BASE} rounded-[14px]`;

/** Badge-teller rechtsboven op een icoonknop. */
export const HEADER_BADGE =
  "absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white";
