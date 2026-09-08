// Gedeelde rij-stijlen voor de donkere dashboard-sidebar (TailAdmin-navy,
// sept 2026). Gebruikt door DashboardNav én AdminNav zodat beide navs in
// dezelfde aside identiek ogen. De aside draagt class="dark" + bg-sidebar
// (zie dashboard-shell.tsx); binnen de sidebar dus altijd sidebar-*-tokens
// of bg-white/N gebruiken — nooit bg-card/bg-background (die worden slate).

/** Compacte rij ≈32px: icoon 16px, tekst 13px. */
export const NAV_ROW =
  "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium leading-5 transition-colors";
export const NAV_ROW_ACTIVE = "bg-sidebar-accent text-sidebar-accent-foreground";
export const NAV_ROW_IDLE = "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-white";
/** Icoon-tint op een idle-rij (actieve rij erft de witte tekstkleur). */
export const NAV_ICON_IDLE = "text-sidebar-foreground/60 group-hover:text-white";
export const NAV_GROUP_LABEL =
  "mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50";
