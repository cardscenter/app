// Hero-banners voor de logged-in homepage. Eén foto per kalenderdag,
// roterend door de array. Voeg gewoon nieuwe filenames toe als er foto's
// bijkomen — de modulo zorgt dat de rotatie automatisch klopt.
//
// Conventie: 3:2 horizontaal, subject in de rechter helft, links rustig
// donker (zodat de tekst-overlay leesbaar blijft).
//
// Locatie van de bestanden: public/images/hero/

const FALLBACK_BANNER = "/images/hero-banner.png";

export const LOGGED_IN_HERO_BANNERS: readonly string[] = [
  "/images/hero/auction_bid.webp",
  "/images/hero/auction_win.webp",
  "/images/hero/claimsale_pile.webp",
  "/images/hero/packaging_preview.webp",
  "/images/hero/pokemon_bg.webp",
];

export function pickDailyBanner(banners: readonly string[] = LOGGED_IN_HERO_BANNERS): string {
  if (banners.length === 0) return FALLBACK_BANNER;
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  return banners[dayIndex % banners.length];
}
