// Gedeelde header-klassen (cleane header, sept 2026). Eén bron zodat de
// loep, bel, berichten, winkelwagen, admin-schild en thema-knop exact dezelfde
// ronde icoonknop zijn. Puur bestand — client én server mogen 'm importeren.

/** Ronde 40px-icoonknop op de donkere header-band. */
export const HEADER_ICON_BTN =
  "relative grid size-10 shrink-0 place-items-center rounded-full text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40";

/** Amber-variant voor het admin-schild. */
export const HEADER_ICON_BTN_ADMIN =
  "relative grid size-10 shrink-0 place-items-center rounded-full text-amber-300 transition-colors hover:bg-amber-500/15 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40";

/** Witte pil-knop (primaire header-CTA, "Registreren"). */
export const HEADER_PILL_LIGHT =
  "inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-white px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40";

const HEADER_PILL_GHOST_BASE =
  "inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap bg-white/10 text-sm font-medium text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40";

/** Doorzichtige pil (saldo). */
export const HEADER_PILL_GHOST = `${HEADER_PILL_GHOST_BASE} rounded-full`;

/** Avatar-pil: zelfde ghost-stijl, maar licht-afgeronde hoeken die
 *  concentrisch lopen met de `rounded-[22%]`-avatar (32px → ~7px) plus de
 *  4px padding van de pil. Zo is de linkerkant niet rond terwijl de foto
 *  hoekig is. */
export const HEADER_AVATAR_PILL = `${HEADER_PILL_GHOST_BASE} rounded-[11px]`;

/** Badge-teller rechtsboven op een icoonknop. */
export const HEADER_BADGE =
  "absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white ring-2 ring-slate-950";
