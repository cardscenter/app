import { Anton, Geist } from "next/font/google";

/**
 * Lettertypes van de nieuwe homepage (design-pass). Anton = smalle, zware
 * display-letter voor de grote uppercase koppen; Geist = lopende tekst.
 * Beide gratis (OFL), geladen via next/font zodat er geen externe requests zijn.
 */
export const landingDisplay = Anton({ weight: "400", subsets: ["latin"], variable: "--cc-display", display: "swap" });
export const landingBody = Geist({ subsets: ["latin"], variable: "--cc-body", display: "swap" });
