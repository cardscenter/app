// Gedeelde rij-stijlen voor de donkere dashboard-zijbalk (design-pass ronde G,
// 2026-10-17): bijna-zwart paneel met witte pil voor de actieve rij en rode
// accenten. Gebruikt door DashboardNav én AdminNav. De aside draagt
// class="dark" + bg-sidebar (zie dashboard-shell.tsx); binnen de zijbalk dus
// altijd sidebar-*-tokens of bg-white/N gebruiken, nooit bg-card/bg-background.

/** Compacte rij ≈34px: icoon 16px, tekst 13px. */
export const NAV_ROW =
  "group flex items-center gap-2.5 rounded-full px-3 py-[7px] text-[13px] font-medium leading-5 transition-colors";
/** Actieve rij: witte pil met inkt-tekst (zoals de actieve tab op de site). */
export const NAV_ROW_ACTIVE = "bg-white text-[var(--cc-ink)]";
export const NAV_ROW_IDLE = "text-sidebar-foreground/75 hover:bg-white/[0.08] hover:text-white";
/** Icoon-tint op een idle-rij (actieve rij erft de tekstkleur). */
export const NAV_ICON_IDLE = "text-sidebar-foreground/50 group-hover:text-white";
/** Groepslabel: klein en rustig, geen hoofdletters. */
export const NAV_GROUP_LABEL = "mb-1.5 px-3 text-xs font-medium text-sidebar-foreground/40";
