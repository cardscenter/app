/**
 * E-mail helper (Fase 37 → Fase 42).
 *
 * `EMAIL_PROVIDER` bepaalt het kanaal:
 *   - "console" (of leeg) → mock: de mail wordt alleen naar de console gelogd,
 *     handig in dev en de testfase. Er wordt niets verstuurd.
 *   - "resend" → écht versturen via Resend (vereist RESEND_API_KEY + EMAIL_FROM).
 *
 * Alle callers (forgot-password, e-mailverificatie, welkom-mail) blijven bij een
 * provider-wissel ongewijzigd doorwerken. Gebruik altijd de specifieke wrapper
 * (sendPasswordResetEmail etc.), niet `sendEmail` direct, zodat de copy op één
 * plek beheerd wordt.
 */

import { Resend } from "resend";
import { renderNotificationEmail, getAppUrl } from "@/lib/email/layout";

interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Extra SMTP-headers, bv. List-Unsubscribe (Fase 16). */
  headers?: Record<string, string>;
}

interface SendEmailResult {
  mocked: boolean;
  messageId?: string;
}

// Module-level gecachede client zodat we 'm niet per mail opnieuw bouwen.
let resendClient: Resend | null = null;
function getResendClient(): Resend {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error(
        "EMAIL_PROVIDER=resend maar RESEND_API_KEY ontbreekt — zet 'm in de env-vars.",
      );
    }
    resendClient = new Resend(key);
  }
  return resendClient;
}

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const provider = process.env.EMAIL_PROVIDER;

  if (provider === "resend") {
    const from = process.env.EMAIL_FROM;
    if (!from) {
      throw new Error(
        "EMAIL_PROVIDER=resend maar EMAIL_FROM ontbreekt — zet de afzender in de env-vars.",
      );
    }
    // Optioneel reply-adres (Fase 16): noreply@ als afzender, maar replies
    // komen binnen op bv. info@poke-center.nl zonder mailbox op het domein.
    const replyTo = process.env.EMAIL_REPLY_TO;
    const { data, error } = await getResendClient().emails.send({
      from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
      ...(replyTo ? { replyTo } : {}),
      ...(args.headers ? { headers: args.headers } : {}),
    });
    if (error) {
      throw new Error(`Resend kon de e-mail niet versturen: ${error.message}`);
    }
    return { mocked: false, messageId: data?.id };
  }

  if (provider && provider !== "console") {
    throw new Error(
      `Onbekende EMAIL_PROVIDER "${provider}" — gebruik "console" of "resend".`,
    );
  }

  // Mock-mode (default): console-log zodat developers de e-mails kunnen zien in
  // de dev-server output. Geen e-mail wordt daadwerkelijk verstuurd.
  const separator = "─".repeat(60);
  console.log(
    `\n📧 [EMAIL MOCK]\n${separator}\nTo:      ${args.to}\nSubject: ${args.subject}\n${separator}\n${args.text}\n${separator}\n`,
  );
  return { mocked: true };
}

// escapeHtml + getAppUrl leven sinds de restyle in layout.ts (layout rendert,
// send-email verstuurt — één import-richting). Re-export voor bestaande callers.
export { escapeHtml, getAppUrl } from "@/lib/email/layout";

/** Reset-password mail. Token is 1 uur geldig. Branded shell (Fase 16). */
export async function sendPasswordResetEmail(args: {
  to: string;
  displayName: string;
  token: string;
  locale?: string;
}) {
  const locale = args.locale ?? "nl";
  const resetUrl = `${getAppUrl()}/${locale}/reset-password?token=${encodeURIComponent(args.token)}`;
  const { html, text } = renderNotificationEmail({
    recipientName: args.displayName,
    title: "Reset je wachtwoord",
    body: `Je hebt een verzoek gedaan om je wachtwoord te resetten. Klik op de knop hieronder om een nieuw wachtwoord in te stellen.

Deze link is 1 uur geldig. Heb je dit niet aangevraagd? Negeer dan dit bericht — je wachtwoord blijft ongewijzigd.`,
    ctaUrl: resetUrl,
    ctaLabel: "Stel een nieuw wachtwoord in",
    categoryLabel: "Account",
  });
  return sendEmail({ to: args.to, subject: "Reset je wachtwoord bij Cards Center", text, html });
}

/** E-mailverificatie mail. Token is 24 uur geldig. Branded shell (Fase 16). */
export async function sendEmailVerificationEmail(args: {
  to: string;
  displayName: string;
  token: string;
  locale?: string;
}) {
  const locale = args.locale ?? "nl";
  const verifyUrl = `${getAppUrl()}/${locale}/verify-email?token=${encodeURIComponent(args.token)}`;
  const { html, text } = renderNotificationEmail({
    recipientName: args.displayName,
    title: "Bevestig je e-mailadres",
    body: `Welkom bij Cards Center! Bevestig je e-mailadres met de knop hieronder — daarna kun je verkopen, bieden en uitbetalen.

Deze link is 24 uur geldig.`,
    ctaUrl: verifyUrl,
    ctaLabel: "Bevestig e-mailadres",
    categoryLabel: "Account",
  });
  return sendEmail({ to: args.to, subject: "Bevestig je e-mailadres", text, html });
}

/** Welkom-mail direct na registratie. Branded shell (Fase 16). */
export async function sendWelcomeEmail(args: {
  to: string;
  displayName: string;
  locale?: string;
}) {
  const locale = args.locale ?? "nl";
  const dashboardUrl = `${getAppUrl()}/${locale}/dashboard`;
  const { html, text } = renderNotificationEmail({
    recipientName: args.displayName,
    title: "Welkom bij Cards Center 🎴",
    body: `Je account staat klaar. Volgende stappen om écht van start te gaan:

• Voeg je bankgegevens toe op je profiel
• Stel je verzendgebied in
• Personaliseer je profiel met een avatar en bio
• Ontdek de marktplaats`,
    ctaUrl: dashboardUrl,
    ctaLabel: "Naar je dashboard",
    categoryLabel: "Welkom",
  });
  return sendEmail({ to: args.to, subject: "Welkom bij Cards Center 🎴", text, html });
}
