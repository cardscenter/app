import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { BETA_COOKIE, betaToken } from "./lib/beta-gate";
import { getToken } from "next-auth/jwt";
import { isFeatureEnabled } from "./lib/feature-flags";
import { featureForPath } from "./lib/feature-routes";

const intlMiddleware = createMiddleware(routing);

/** Verhuizing /verkoop-calculator* → /verkopen* (launch-prep). Oud segment →
 *  nieuw segment; alleen locale-geprefixte paden komen door de matcher. */
const LEGACY_SELL_SEGMENTS: Record<string, string> = {
  "": "",
  collectie: "losse-kaarten",
  bulk: "bulk",
  verpakken: "verpakken",
  voorwaarden: "voorwaarden-bulk",
  "voorwaarden-collectie": "voorwaarden-losse-kaarten",
};

/** Leest alleen `accountType` uit de Auth.js-sessie-JWT (cookie), zonder DB.
 *  Probeert de secure- én de gewone cookienaam: achter de Railway-proxy kan
 *  `nextUrl.protocol` http zijn terwijl de cookie als __Secure- is gezet. */
async function accountTypeFromJwt(request: NextRequest): Promise<string | null> {
  return (await sessionFromJwt(request))?.accountType ?? null;
}

/** accountType + rol (Fase 2) uit de sessie-JWT, zonder DB. null = niet ingelogd. */
async function sessionFromJwt(request: NextRequest): Promise<{ accountType: string | null; role: string | null } | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  const preferSecure = request.nextUrl.protocol === "https:";
  for (const secureCookie of [preferSecure, !preferSecure]) {
    const token = await getToken({ req: request, secret, secureCookie });
    if (token) {
      return {
        accountType: typeof token.accountType === "string" ? token.accountType : null,
        role: typeof token.role === "string" ? token.role : null,
      };
    }
  }
  return null;
}

/** Matcht de unlock-pagina (`/beta`, `/nl/beta`, `/en/beta`) — die moet altijd
 *  bereikbaar blijven, anders kan niemand de gate ontgrendelen. */
function isBetaUnlockPath(pathname: string): boolean {
  return /^\/(?:nl|en)?\/?beta\/?$/.test(pathname);
}

export default async function middleware(request: NextRequest) {
  // TIJDELIJKE LOCKDOWN (Fase 44): personalisatie is niet toegankelijk —
  // harde 307 op middleware-niveau zodat de pagina-inhoud nooit rendert.
  // De layout-guard in app/[locale]/customization/layout.tsx is de
  // belt-and-braces; verwijder beide om de hub te heropenen.
  {
    const custMatch = request.nextUrl.pathname.match(/^\/(nl|en)\/customization(?:\/|$)/);
    if (custMatch) {
      const url = request.nextUrl.clone();
      url.pathname = `/${custMatch[1]}/dashboard`;
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // Permanente redirect van de oude inkoop-URL's naar /verkopen/*. Vóór de
  // beta-gate zodat de bezoeker direct op het nieuwe pad landt. Onbekende
  // sub-segmenten vallen door naar de intl-middleware (404 zoals voorheen).
  {
    const legacy = request.nextUrl.pathname.match(
      /^\/(nl|en)\/verkoop-calculator(?:\/([^/]+))?\/?$/,
    );
    if (legacy) {
      const [, locale, segment = ""] = legacy;
      const target = LEGACY_SELL_SEGMENTS[segment];
      if (target !== undefined) {
        const url = request.nextUrl.clone();
        url.pathname = `/${locale}/verkopen${target ? `/${target}` : ""}`;
        return NextResponse.redirect(url, 308);
      }
    }
  }

  // Spelersprofiel (Community Hub, Fase 2): /verkoper/<id> → /spelers/<id>,
  // permanent, zodat oude links (mails, meldingen) blijven werken.
  {
    const seller = request.nextUrl.pathname.match(/^\/(nl|en)\/verkoper\/([^/]+)\/?$/);
    if (seller) {
      const url = request.nextUrl.clone();
      url.pathname = `/${seller[1]}/spelers/${seller[2]}`;
      return NextResponse.redirect(url, 308);
    }
  }

  // Feature-flags (Community Hub, Fase 1): verborgen handelsfuncties gaan
  // netjes naar de homepage van de locale. Alleen admins komen erdoor (JWT-
  // check zonder DB). De page-layouts (createFeatureLayout) zijn de
  // autoritatieve guard; dit is de snelle weg vóór render. /api/* valt buiten
  // de matcher en heeft per-route guards.
  {
    const flag = featureForPath(request.nextUrl.pathname);
    if (flag && !isFeatureEnabled(flag)) {
      const accountType = await accountTypeFromJwt(request);
      if (accountType !== "ADMIN") {
        const localeMatch = request.nextUrl.pathname.match(/^\/(nl|en)(?:\/|$)/);
        const url = request.nextUrl.clone();
        url.pathname = `/${localeMatch ? localeMatch[1] : routing.defaultLocale}`;
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
  }

  // Admin- en staff-bomen (Community Hub, Fase 3): harde 307 vóór render.
  // Een redirect vanuit een layout alleen is zacht: bij parallelle RSC-
  // rendering lekt de pagina-inhoud met status 200 (zelfde les als de
  // customization-lockdown). De layouts/pages blijven belt-and-braces.
  {
    // /keuken (Fase 4) telt als staff-boom.
    const m = request.nextUrl.pathname.match(/^\/(nl|en)\/(?:dashboard\/(admin|staff)|(keuken))(?:\/|$)/);
    if (m) {
      const tree = m[2] ?? "staff";
      const session = await sessionFromJwt(request);
      const url = request.nextUrl.clone();
      url.search = "";
      if (!session) {
        url.pathname = `/${m[1]}/login`;
        url.search = `?callbackUrl=${encodeURIComponent(request.nextUrl.pathname.replace(/^\/(nl|en)/, ""))}`;
        return NextResponse.redirect(url);
      }
      const isAdmin = session.accountType === "ADMIN";
      const allowed = tree === "admin" ? isAdmin : isAdmin || session.role === "STAFF";
      if (!allowed) {
        url.pathname = `/${m[1]}/dashboard`;
        return NextResponse.redirect(url);
      }
    }
  }

  if (process.env.BETA_GATE === "true") {
    const password = process.env.BETA_ACCESS_PASSWORD;
    const { pathname } = request.nextUrl;

    if (password && !isBetaUnlockPath(pathname)) {
      const cookie = request.cookies.get(BETA_COOKIE)?.value;
      const expected = await betaToken(password);
      if (cookie !== expected) {
        const url = request.nextUrl.clone();
        const localeMatch = pathname.match(/^\/(nl|en)(?:\/|$)/);
        const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;
        url.pathname = `/${locale}/beta`;
        // TODO (beta-gate): dit gooit ook ?token= van reset-/verificatielinks weg —
        // de gate verdwijnt bij launch, dus bewust niet opgelost.
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/", "/(nl|en)/:path*"],
};
