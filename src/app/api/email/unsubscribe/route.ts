/**
 * E-mail unsubscribe-endpoint (Fase 16). Geen login vereist — de link in de
 * mail-footer moet ook werken op een telefoon waar de user niet ingelogd is.
 * Beveiliging: stateless HMAC-token (zie src/lib/email/unsubscribe.ts).
 *
 * GET  → mens klikt de footer-link: pref uit + nette NL-bevestigingspagina.
 * POST → RFC 8058 one-click (List-Unsubscribe-Post header, Gmail/Yahoo
 *        drukken zelf op de knop): zelfde flip, kale 200.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import {
  parseEmailPreferences,
  EMAIL_PREF_CATEGORIES,
} from "@/lib/email/preferences-config";

async function applyUnsubscribe(token: string | null): Promise<{ ok: boolean; label?: string }> {
  if (!token) return { ok: false };
  const verified = verifyUnsubscribeToken(token);
  if (!verified) return { ok: false };

  const user = await prisma.user.findUnique({
    where: { id: verified.userId },
    select: { emailPreferences: true },
  });
  if (!user) return { ok: false };

  const prefs = parseEmailPreferences(user.emailPreferences);
  prefs[verified.category] = false;
  await prisma.user.update({
    where: { id: verified.userId },
    data: { emailPreferences: JSON.stringify(prefs) },
  });

  const label = EMAIL_PREF_CATEGORIES.find((c) => c.key === verified.category)?.label;
  return { ok: true, label };
}

function htmlPage(title: string, body: string): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <meta name="robots" content="noindex">
  <title>${title} — Cards Center</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
           background: #f4f7fa; color: #1a2b3c; margin: 0; padding: 40px 16px; }
    .card { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 16px;
            padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); text-align: center; }
    h1 { font-size: 22px; color: #0a1e2f; margin: 0 0 12px; }
    p { font-size: 15px; color: #2a3b4c; line-height: 1.5; margin: 0 0 20px; }
    a.btn { display: inline-block; background: #2563eb; color: #fff; padding: 12px 28px;
            border-radius: 40px; font-weight: 600; font-size: 15px; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${body}</p>
    <a class="btn" href="/nl/dashboard/meldingen">Naar mijn voorkeuren</a>
  </div>
</body>
</html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(request: NextRequest) {
  const result = await applyUnsubscribe(request.nextUrl.searchParams.get("token"));
  if (!result.ok) {
    return htmlPage(
      "Link niet (meer) geldig",
      "Deze afmeldlink klopt niet. Je kunt je e-mailvoorkeuren altijd aanpassen op je meldingen-pagina.",
    );
  }
  return htmlPage(
    "Je bent afgemeld",
    `Je ontvangt geen e-mails meer in de categorie "${result.label}". In-app meldingen blijf je gewoon zien. Weer aanzetten kan op je meldingen-pagina.`,
  );
}

// RFC 8058 one-click unsubscribe — mailclients POSTen zonder de pagina te tonen.
export async function POST(request: NextRequest) {
  const result = await applyUnsubscribe(request.nextUrl.searchParams.get("token"));
  return NextResponse.json({ success: result.ok }, { status: result.ok ? 200 : 400 });
}
