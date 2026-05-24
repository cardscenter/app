import type { MetadataRoute } from "next";

/**
 * Robots-regels. Zolang de beta-gate aan staat (`BETA_GATE=true`) weren we alle
 * crawlers — belt-and-braces bovenop de wachtwoord-gate zodat de testsite niet
 * geïndexeerd raakt. Bij launch (`BETA_GATE` uit) geven we de site vrij en
 * verwijzen we naar de sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.BETA_GATE === "true") {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL;
  return {
    rules: { userAgent: "*", allow: "/" },
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
