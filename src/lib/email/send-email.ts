/**
 * E-mail helper (Fase 37).
 *
 * Mock-implementatie: console-logt de e-mail in dev en wanneer er geen echte
 * provider geconfigureerd is. Fase 16 (Email notificaties) swappt de body van
 * `sendEmail()` naar een echte SMTP/Resend/Mailgun-call — alle callers
 * (forgot-password, e-mailverificatie, welkom-mail) blijven dan ongewijzigd
 * doorwerken.
 *
 * Gebruik altijd de specifieke wrapper (sendPasswordResetEmail etc.) niet
 * `sendEmail` direct, zodat de copy in één plek beheerd wordt.
 */

interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface SendEmailResult {
  mocked: boolean;
  messageId?: string;
}

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const provider = process.env.EMAIL_PROVIDER;
  const isProductionProvider = provider && provider !== "console";

  if (!isProductionProvider) {
    // Mock-mode: console-log zodat developers de e-mails kunnen zien in
    // de dev-server output. Geen e-mail wordt daadwerkelijk verstuurd.
    const separator = "─".repeat(60);
    console.log(
      `\n📧 [EMAIL MOCK]\n${separator}\nTo:      ${args.to}\nSubject: ${args.subject}\n${separator}\n${args.text}\n${separator}\n`,
    );
    return { mocked: true };
  }

  // Fase 16: swap deze branch naar de gekozen provider (Resend / SMTP / etc.).
  // Voor nu nooit bereikbaar omdat EMAIL_PROVIDER niet gezet wordt.
  throw new Error(
    `Email provider "${provider}" is configured but not implemented yet — wacht op Fase 16.`,
  );
}

/** App-URL helper — gebruikt NEXTAUTH_URL of fallback voor links in e-mails. */
function getAppUrl(): string {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

/** Reset-password mail. Token is 1 uur geldig. */
export async function sendPasswordResetEmail(args: {
  to: string;
  displayName: string;
  token: string;
  locale?: string;
}) {
  const locale = args.locale ?? "nl";
  const resetUrl = `${getAppUrl()}/${locale}/reset-password?token=${encodeURIComponent(args.token)}`;
  const text = `Hoi ${args.displayName},

Je hebt een verzoek gedaan om je wachtwoord te resetten. Klik op de onderstaande link om een nieuw wachtwoord in te stellen:

${resetUrl}

Deze link is 1 uur geldig. Heb je dit niet aangevraagd? Negeer dan dit bericht — je wachtwoord blijft ongewijzigd.

— Team Cards Center`;
  const html = `<p>Hoi ${escapeHtml(args.displayName)},</p>
<p>Je hebt een verzoek gedaan om je wachtwoord te resetten. Klik op de onderstaande link om een nieuw wachtwoord in te stellen:</p>
<p><a href="${resetUrl}">${resetUrl}</a></p>
<p>Deze link is 1 uur geldig. Heb je dit niet aangevraagd? Negeer dan dit bericht — je wachtwoord blijft ongewijzigd.</p>
<p>— Team Cards Center</p>`;
  return sendEmail({ to: args.to, subject: "Reset je wachtwoord bij Cards Center", text, html });
}

/** E-mailverificatie mail. Token is 24 uur geldig. */
export async function sendEmailVerificationEmail(args: {
  to: string;
  displayName: string;
  token: string;
  locale?: string;
}) {
  const locale = args.locale ?? "nl";
  const verifyUrl = `${getAppUrl()}/${locale}/verify-email?token=${encodeURIComponent(args.token)}`;
  const text = `Hoi ${args.displayName},

Welkom bij Cards Center! Bevestig je e-mailadres door op onderstaande link te klikken:

${verifyUrl}

Deze link is 24 uur geldig.

— Team Cards Center`;
  const html = `<p>Hoi ${escapeHtml(args.displayName)},</p>
<p>Welkom bij Cards Center! Bevestig je e-mailadres door op onderstaande link te klikken:</p>
<p><a href="${verifyUrl}">${verifyUrl}</a></p>
<p>Deze link is 24 uur geldig.</p>
<p>— Team Cards Center</p>`;
  return sendEmail({ to: args.to, subject: "Bevestig je e-mailadres", text, html });
}

/** Welkom-mail direct na registratie. */
export async function sendWelcomeEmail(args: {
  to: string;
  displayName: string;
  locale?: string;
}) {
  const locale = args.locale ?? "nl";
  const dashboardUrl = `${getAppUrl()}/${locale}/dashboard`;
  const text = `Hoi ${args.displayName},

Welkom bij Cards Center! Je account staat klaar.

Volgende stappen om écht van start te gaan:
• Voeg je bankgegevens toe op je profiel
• Stel je verzendgebied in
• Personaliseer je profiel met een avatar en bio
• Ontdek de marktplaats

Direct naar je dashboard: ${dashboardUrl}

Vragen? Reply gerust op deze mail — we lezen ze allemaal.

— Team Cards Center`;
  const html = `<p>Hoi ${escapeHtml(args.displayName)},</p>
<p>Welkom bij Cards Center! Je account staat klaar.</p>
<p><strong>Volgende stappen om écht van start te gaan:</strong></p>
<ul>
  <li>Voeg je bankgegevens toe op je profiel</li>
  <li>Stel je verzendgebied in</li>
  <li>Personaliseer je profiel met een avatar en bio</li>
  <li>Ontdek de marktplaats</li>
</ul>
<p><a href="${dashboardUrl}">Direct naar je dashboard</a></p>
<p>Vragen? Reply gerust op deze mail — we lezen ze allemaal.</p>
<p>— Team Cards Center</p>`;
  return sendEmail({ to: args.to, subject: "Welkom bij Cards Center 🎴", text, html });
}

/** Minimalistische HTML-escape voor user-input in mail-templates. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
