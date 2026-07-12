/**
 * Gedeelde branded e-mail-shell voor notificatie-mails (Fase 16).
 *
 * Visueel ontwerp overgenomen van de Cards Center Shopify-bestelbevestiging:
 * lichte #f4f7fa-achtergrond, witte 600px-container met zachte shadow,
 * header met logo + categorie-pill, blauwe pill-CTA (#2563eb) + outline-knop,
 * footer met support-adres en uitschrijfregel.
 *
 * Table-based markup + embedded <style> (e-mailclient-safe; Gmail/Outlook.com
 * ondersteunen <style> in <head>, kritieke kleuren staan óók inline).
 * Rijkere per-type varianten (bv. prijstabel) kunnen later via de bodyHtml-slot.
 */

/** App-URL helper — gebruikt NEXTAUTH_URL of fallback voor links in e-mails. */
export function getAppUrl(): string {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

/** Minimalistische HTML-escape voor user-input in mail-templates. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface RenderArgs {
  recipientName: string;
  title: string;
  /** Plain-text body — wordt ge-escaped en met <br> gerenderd. */
  body: string;
  /** Absolute of site-relatieve URL voor de primaire CTA-knop. */
  ctaUrl?: string;
  ctaLabel?: string;
  /** Volledige unsubscribe-URL; weggelaten voor altijd-aan account-mails. */
  unsubscribeUrl?: string;
  /** Korte pill-tekst rechtsboven, bv. "Bestelling" of "Veiling". */
  categoryLabel?: string;
}

export function renderNotificationEmail(args: RenderArgs): { html: string; text: string } {
  const appUrl = getAppUrl();
  const logoUrl = `${appUrl}/images/logo-white-bg.png`;
  const dashboardUrl = `${appUrl}/nl/dashboard`;
  const supportUrl = `${appUrl}/nl/support`;
  const ctaUrl = args.ctaUrl
    ? args.ctaUrl.startsWith("http")
      ? args.ctaUrl
      : `${appUrl}/nl${args.ctaUrl.startsWith("/") ? "" : "/"}${args.ctaUrl}`
    : null;
  const ctaLabel = args.ctaLabel ?? "Bekijk op Cards Center";

  const bodyHtml = escapeHtml(args.body).replace(/\n/g, "<br>");

  const text = `Hoi ${args.recipientName},

${args.title}

${args.body}
${ctaUrl ? `\n${ctaLabel}: ${ctaUrl}\n` : ""}
Hulp nodig? Open een support ticket: ${supportUrl}

— Team Cards Center${
    args.unsubscribeUrl
      ? `\n\nGeen mails meer over dit onderwerp? Afmelden: ${args.unsubscribeUrl}`
      : ""
  }`;

  const html = `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <meta name="viewport" content="width=device-width">
  <title>${escapeHtml(args.title)}</title>
  <style>
    body, table, td, p, a {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0; padding: 0; box-sizing: border-box;
    }
    body { background-color: #f4f7fa; color: #1a2b3c; line-height: 1.5; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #f4f7fa; padding: 24px 0; }
    .main-container {
      max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff;
      border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.05);
    }
    h1 { font-size: 26px; font-weight: 600; color: #0a1e2f; margin: 0 0 16px 0; letter-spacing: -0.02em; }
    p { font-size: 16px; color: #2a3b4c; margin: 0 0 16px 0; }
    a { color: #2563eb; text-decoration: none; font-weight: 500; }
    .header {
      padding: 20px 40px; background: linear-gradient(145deg, #ffffff 0%, #fafcff 100%);
      border-bottom: 1px solid #e6edf5; width: 100%;
    }
    .content { padding: 32px 40px; width: 100%; }
    .footer {
      padding: 28px 40px; background-color: #f0f5fa; text-align: center;
      border-top: 1px solid #e0e9f2; width: 100%;
    }
    .category-badge {
      display: inline-block; background-color: #eef3f8; color: #1a2b3c; font-size: 14px;
      font-weight: 600; padding: 6px 14px; border-radius: 40px; white-space: nowrap;
    }
    .button-container { width: 100%; margin: 28px 0 8px 0; }
    .button-container table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .button-container td { padding: 0 6px; vertical-align: middle; }
    .button-container td:first-child { padding-left: 0; }
    .button-container td:last-child { padding-right: 0; }
    .button {
      display: block; background-color: #2563eb; color: #ffffff !important; padding: 14px 0;
      border-radius: 40px; font-weight: 600; font-size: 16px; text-decoration: none;
      text-align: center; width: 100%; box-sizing: border-box;
    }
    .button-outline {
      display: block; background-color: transparent; color: #2563eb !important; padding: 12px 0;
      border-radius: 40px; font-weight: 600; font-size: 16px; text-decoration: none;
      border: 2px solid #2563eb; text-align: center; width: 100%; box-sizing: border-box;
    }
    .kleine-tekst { font-size: 13px; color: #6b7c8d; margin: 16px 0 0 0; }
    @media (max-width: 600px) {
      .header, .content, .footer { padding: 24px 20px; }
      .button-container td { display: block; width: 100%; padding: 6px 0 !important; text-align: center; }
      .button-container td:first-child { padding-top: 0 !important; }
      .button-container td:last-child { padding-bottom: 0 !important; }
    }
  </style>
</head>
<body style="background-color:#f4f7fa;">
  <table class="wrapper" width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center">
        <table class="main-container" width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td class="header" width="100%">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="left" width="70%">
                    <img src="${logoUrl}" alt="Cards Center" height="40" style="max-height:40px;width:auto;">
                  </td>
                  <td align="right" width="30%">
                    ${args.categoryLabel ? `<span class="category-badge">${escapeHtml(args.categoryLabel)}</span>` : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="content" width="100%">
              <p style="margin-bottom:8px;">Hoi ${escapeHtml(args.recipientName)},</p>
              <h1>${escapeHtml(args.title)}</h1>
              <p>${bodyHtml}</p>
              ${
                ctaUrl
                  ? `<div class="button-container">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td width="50%" align="center">
                      <a href="${ctaUrl}" class="button" style="background-color:#2563eb;color:#ffffff;">${escapeHtml(ctaLabel)}</a>
                    </td>
                    <td width="50%" align="center">
                      <a href="${dashboardUrl}" class="button-outline" style="color:#2563eb;">Mijn dashboard</a>
                    </td>
                  </tr>
                </table>
              </div>`
                  : `<p><a href="${dashboardUrl}">Naar mijn dashboard</a></p>`
              }
            </td>
          </tr>
          <tr>
            <td class="footer" width="100%">
              <p style="margin-bottom:8px;font-size:14px;">Hulp nodig? <a href="${supportUrl}" style="color:#2563eb;text-decoration:underline;font-weight:500;">Open een support ticket</a>. Dit adres wordt niet gelezen.</p>
              <p style="color:#6b7c8d;font-size:14px;margin-bottom:0;">&copy; Cards Center &ndash; Alle rechten voorbehouden</p>
              ${
                args.unsubscribeUrl
                  ? `<p class="kleine-tekst">Je ontvangt deze e-mail omdat je meldingen aan hebt staan voor dit onderwerp.
                <a href="${args.unsubscribeUrl}" style="color:#6b7c8d;text-decoration:underline;">Afmelden voor deze mails</a></p>`
                  : `<p class="kleine-tekst">Dit is een belangrijke servicemail over je account.</p>`
              }
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { html, text };
}
