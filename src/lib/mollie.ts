import "server-only";
import createMollieClient, { Locale, type MollieClient, type Payment as MolliePayment } from "@mollie/api-client";
import { getSiteUrl } from "@/lib/site-url";
import { toMollieAmount } from "@/lib/shop-events/config";

/**
 * Mollie-wrapper (Community Hub, Fase 3). Eén profiel voor tickets én eten.
 *
 * - `MOLLIE_API_KEY` leeg → **simulatiemodus** (provider "FAKE"), maar in
 *   productie alleen met `PAYMENT_SIMULATION=true` (anders kan iedereen op de
 *   live site gratis "betalen"); zonder die vlag faalt het starten van een
 *   betaling netjes met een foutmelding. Lokaal altijd aan. Er wordt
 *   geen externe call gedaan; de checkout-URL wijst naar `/betalen/simuleer/<id>`
 *   waar je lokaal "geslaagd" of "mislukt" kiest. Zo is de hele flow te
 *   testen zonder Mollie-account of publieke webhook-URL.
 * - `test_...`-key → Mollie test-modus (echte checkout-pagina, geen echt geld).
 * - `live_...`-key → productie.
 *
 * De webhook (`/api/mollie/webhook`) is de bron van waarheid; bij terugkeer
 * van de checkout halen we de status óók direct op (`fetchProviderPayment`),
 * zodat lokaal/zonder webhook de bevestiging niet op de cron hoeft te wachten.
 */

let client: MollieClient | null = null;

export function isMollieConfigured(): boolean {
  return !!process.env.MOLLIE_API_KEY?.trim();
}

/**
 * Mag de betaalsimulatie gebruikt worden? Nooit zodra Mollie geconfigureerd is;
 * lokaal altijd; in productie alleen met `PAYMENT_SIMULATION=true|1|on`.
 */
export function isPaymentSimulationAllowed(): boolean {
  if (isMollieConfigured()) return false;
  if (process.env.NODE_ENV !== "production") return true;
  const v = process.env.PAYMENT_SIMULATION?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "on";
}

export const PAYMENTS_UNAVAILABLE_ERROR = "Online betalen is nog niet beschikbaar.";

export function mollieMode(): "fake" | "test" | "live" {
  const key = process.env.MOLLIE_API_KEY?.trim();
  if (!key) return "fake";
  return key.startsWith("live_") ? "live" : "test";
}

function getClient(): MollieClient {
  if (!client) {
    const apiKey = process.env.MOLLIE_API_KEY?.trim();
    if (!apiKey) throw new Error("MOLLIE_API_KEY ontbreekt");
    client = createMollieClient({ apiKey });
  }
  return client;
}

export interface CreatedProviderPayment {
  provider: "MOLLIE" | "FAKE";
  providerPaymentId: string;
  checkoutUrl: string;
  status: string;
}

export async function createProviderPayment(args: {
  /** Onze Payment.id — komt terug in de webhook-metadata. */
  paymentId: string;
  amount: number;
  description: string;
  /** Locale-geprefixt pad waar de klant na betalen landt (bv. /nl/evenementen/x/bedankt?r=...). */
  redirectPath: string;
  metadata?: Record<string, string>;
  locale?: string;
}): Promise<CreatedProviderPayment> {
  const siteUrl = getSiteUrl();
  if (!isMollieConfigured()) {
    if (!isPaymentSimulationAllowed()) throw new Error(PAYMENTS_UNAVAILABLE_ERROR);
    const id = `fake_${args.paymentId}`;
    return {
      provider: "FAKE",
      providerPaymentId: id,
      checkoutUrl: `/${args.locale ?? "nl"}/betalen/simuleer/${args.paymentId}`,
      status: "open",
    };
  }
  // De create-overload met callback maakt het type `Promise<Payment> & void`;
  // zonder callback is het gewoon een Payment.
  const payment = (await getClient().payments.create({
    amount: { currency: "EUR", value: toMollieAmount(args.amount) },
    description: args.description,
    redirectUrl: `${siteUrl}${args.redirectPath}`,
    webhookUrl: `${siteUrl}/api/mollie/webhook`,
    locale: args.locale === "en" ? Locale.en_US : Locale.nl_NL,
    metadata: { paymentId: args.paymentId, ...(args.metadata ?? {}) },
  })) as MolliePayment;
  const checkoutUrl = payment.getCheckoutUrl();
  if (!checkoutUrl) throw new Error("Mollie gaf geen checkout-URL terug");
  return { provider: "MOLLIE", providerPaymentId: payment.id, checkoutUrl, status: String(payment.status) };
}

/** Actuele status bij Mollie ophalen (webhook + terugkeer-pagina). */
export async function fetchProviderPayment(providerPaymentId: string): Promise<{ status: string; paidAt: Date | null; amountRefunded: number } | null> {
  if (providerPaymentId.startsWith("fake_")) return null;
  if (!isMollieConfigured()) return null;
  const p = await getClient().payments.get(providerPaymentId);
  return {
    status: String(p.status),
    paidAt: p.paidAt ? new Date(p.paidAt) : null,
    amountRefunded: p.amountRefunded ? Number(p.amountRefunded.value) : 0,
  };
}

/** Terugbetaling (volledig of deel). In simulatiemodus direct "refunded". */
export async function refundProviderPayment(args: { providerPaymentId: string; amount: number; description: string }): Promise<{ refundId: string; status: string }> {
  if (args.providerPaymentId.startsWith("fake_") || !isMollieConfigured()) {
    return { refundId: `fake_re_${Date.now().toString(36)}`, status: "refunded" };
  }
  const refund = await getClient().paymentRefunds.create({
    paymentId: args.providerPaymentId,
    amount: { currency: "EUR", value: toMollieAmount(args.amount) },
    description: args.description,
  });
  return { refundId: refund.id, status: String(refund.status) };
}
