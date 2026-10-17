/**
 * Pastel-tonen voor dashboard-iconen, tegels en callouts (design-pass ronde G).
 * Eén bron zodat losse `bg-amber-500/10 text-amber-600`-tints niet meer nodig
 * zijn. Client-importable (alleen strings).
 */
export type DashTone = "pink" | "yellow" | "blue" | "green" | "ink" | "red" | "neutral";

/** Icoon-cirkel / klein vlak: achtergrond + icoonkleur. */
export const TONE_ICON: Record<DashTone, string> = {
  pink: "bg-[var(--pastel-pink)] text-[var(--pastel-pink-ink)]",
  yellow: "bg-[var(--pastel-yellow)] text-[var(--pastel-yellow-ink)]",
  blue: "bg-[var(--pastel-blue)] text-[var(--pastel-blue-ink)]",
  green: "bg-[var(--pastel-green)] text-[var(--pastel-green-ink)]",
  ink: "bg-[var(--foreground)] text-white",
  red: "cc-grad text-white",
  neutral: "bg-[var(--background)] text-[var(--foreground)]/70",
};

/** Groot vlak (callout, sectie-achtergrond): pastel met inkt-tekst. */
export const TONE_SURFACE: Record<DashTone, string> = {
  pink: "bg-[var(--pastel-pink)] text-[var(--pastel-pink-ink)]",
  yellow: "bg-[var(--pastel-yellow)] text-[var(--pastel-yellow-ink)]",
  blue: "bg-[var(--pastel-blue-light)] text-[var(--pastel-blue-ink)]",
  green: "bg-[var(--pastel-green)] text-[var(--pastel-green-ink)]",
  ink: "bg-[var(--cc-dark)] text-white",
  red: "cc-grad text-white",
  neutral: "bg-white text-[var(--foreground)]",
};
