import { Anton, Geist, Geist_Mono } from "next/font/google";

/**
 * Site-brede lettertypes (design-pass 2026-10, Ploy-stijl): Geist voor alle
 * tekst, Geist Mono voor codes/tickets, Anton voor de grote uppercase
 * display-koppen (opt-in via `.cc-display` of `font-display`). Alle drie gratis
 * (OFL) en via next/font gebundeld, dus geen externe font-requests.
 */
export const bodyFont = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
export const monoFont = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
export const displayFont = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton", display: "swap" });
