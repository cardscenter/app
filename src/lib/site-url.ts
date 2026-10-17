// Publieke site-URL voor absolute links (e-mails, sitemap, ICS-export,
// shop-URL-preview). Leest NEXT_PUBLIC_SITE_URL (build-time ingelined, dus ook
// client-side beschikbaar) met NEXTAUTH_URL als server-side fallback.
//
// In productie horen beide gezet te zijn (Railway service-vars); ontbreken ze,
// dan vallen we terug op localhost en loggen we dat éénmalig — anders staan
// er stilletjes localhost-links in uitgaande mails.
const DEV_FALLBACK = "http://localhost:3000";
let warned = false;

/** Site-URL zonder trailing slash, bv. "https://cardscenter.up.railway.app". */
export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL;
  if (url) return url.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production" && typeof window === "undefined" && !warned) {
    warned = true;

    console.warn(
      "[site-url] NEXT_PUBLIC_SITE_URL én NEXTAUTH_URL ontbreken — absolute links vallen terug op localhost",
    );
  }
  return DEV_FALLBACK;
}

/** Host zonder protocol, bv. "cardscenter.up.railway.app" — voor URL-previews in de UI. */
export function getSiteHost(): string {
  return new URL(getSiteUrl()).host;
}
