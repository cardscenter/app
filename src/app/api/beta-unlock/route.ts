import { NextResponse, type NextRequest } from "next/server";
import { BETA_COOKIE, betaToken } from "@/lib/beta-gate";

export const runtime = "nodejs";

/**
 * Beta-gate unlock. Ligt onder `/api/*` zodat de middleware-matcher 'm niet
 * raakt en de route altijd bereikbaar is. Vergelijkt het ingevulde wachtwoord
 * met `BETA_ACCESS_PASSWORD` en zet bij match een httpOnly-cookie met de
 * afgeleide token (niet het wachtwoord zelf).
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const localeRaw = String(formData.get("locale") ?? "nl");
  const locale = localeRaw === "en" ? "en" : "nl";
  const expected = process.env.BETA_ACCESS_PASSWORD;
  const origin = request.nextUrl.origin;

  if (!expected || password !== expected) {
    return NextResponse.redirect(`${origin}/${locale}/beta?error=1`, {
      status: 303,
    });
  }

  const token = await betaToken(expected);
  const res = NextResponse.redirect(`${origin}/${locale}`, { status: 303 });
  res.cookies.set(BETA_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 dagen
  });
  return res;
}
