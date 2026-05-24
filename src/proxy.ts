import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { BETA_COOKIE, betaToken } from "./lib/beta-gate";

const intlMiddleware = createMiddleware(routing);

/** Matcht de unlock-pagina (`/beta`, `/nl/beta`, `/en/beta`) — die moet altijd
 *  bereikbaar blijven, anders kan niemand de gate ontgrendelen. */
function isBetaUnlockPath(pathname: string): boolean {
  return /^\/(?:nl|en)?\/?beta\/?$/.test(pathname);
}

export default async function middleware(request: NextRequest) {
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
