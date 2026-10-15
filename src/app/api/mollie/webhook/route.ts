import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchProviderPayment, isMollieConfigured } from "@/lib/mollie";
import { applyPaymentStatus } from "@/lib/shop-events/registrations";

export const runtime = "nodejs";

/**
 * Mollie-webhook (Community Hub, Fase 3): Mollie POST't `id=tr_...` zodra een
 * betaling van status verandert. We vertrouwen het bericht zelf niet, maar
 * halen de betaling altijd opnieuw op bij Mollie en verwerken die status
 * idempotent (`applyPaymentStatus`). Altijd 200 teruggeven voor bekende
 * betalingen; onbekende id's ook 200 (anders blijft Mollie herhalen).
 */
export async function POST(request: Request) {
  if (!isMollieConfigured()) return NextResponse.json({ ok: true, ignored: "mollie-not-configured" });

  let id: string | null = null;
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { id?: string };
      id = typeof body.id === "string" ? body.id : null;
    } else {
      const form = await request.formData();
      const v = form.get("id");
      id = typeof v === "string" ? v : null;
    }
  } catch {
    id = null;
  }
  if (!id || !/^[a-z]{2}_[A-Za-z0-9]+$/.test(id)) return NextResponse.json({ ok: true, ignored: "no-id" });

  const payment = await prisma.payment.findUnique({ where: { providerPaymentId: id }, select: { id: true } });
  if (!payment) return NextResponse.json({ ok: true, ignored: "unknown-payment" });

  try {
    const remote = await fetchProviderPayment(id);
    if (!remote) return NextResponse.json({ ok: true, ignored: "no-remote" });
    const result = await applyPaymentStatus({ paymentId: payment.id, providerStatus: remote.status, paidAt: remote.paidAt, source: "webhook" });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[mollie webhook] verwerking mislukt", err);
    // 500 → Mollie probeert het later opnieuw.
    return NextResponse.json({ error: "processing-failed" }, { status: 500 });
  }
}
