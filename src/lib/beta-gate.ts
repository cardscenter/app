/**
 * Beta-gate (pre-launch). Schermt de hele site af achter één gedeeld
 * wachtwoord zolang `BETA_GATE=true`. De afgeleide token (SHA-256 van het
 * wachtwoord) wordt in een httpOnly-cookie gezet — het wachtwoord zelf belandt
 * dus nooit in de browser. Gedeeld door de Edge-middleware (`src/proxy.ts`) en
 * de Node-route (`/api/beta-unlock`) zodat beide exact dezelfde token afleiden.
 *
 * Web Crypto (`crypto.subtle`) werkt in zowel Edge- als Node-runtime.
 */

export const BETA_COOKIE = "cc_beta";

/** SHA-256-hex van het beta-wachtwoord met een vaste salt-prefix. */
export async function betaToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`cards-center-beta:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
