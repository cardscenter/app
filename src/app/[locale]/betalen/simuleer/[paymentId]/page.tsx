import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { FlaskConical } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isMollieConfigured } from "@/lib/mollie";
import { PageContainer } from "@/components/layout/page-container";
import { SimulatePaymentButtons } from "@/components/shop-events/simulate-payment-buttons";
import { formatPrice } from "@/lib/shop-events/format";

export const dynamic = "force-dynamic";

/**
 * Simulatie van de Mollie-checkout (alleen zonder MOLLIE_API_KEY). Vervangt
 * de bankpagina: kies "betaling geslaagd" of "mislukt" en je landt op de
 * gewone bedankt-pagina, precies zoals bij een echte betaling.
 */
export default async function SimulatePaymentPage({ params }: { params: Promise<{ locale: string; paymentId: string }> }) {
  const { locale, paymentId } = await params;
  setRequestLocale(locale);
  if (isMollieConfigured()) notFound();
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { registration: { select: { id: true, eventId: true, event: { select: { title: true } } } } },
  });
  if (!payment || payment.userId !== session.user.id || payment.provider !== "FAKE") notFound();

  const returnPath = payment.registration ? `/evenementen/${payment.registration.eventId}/bedankt?r=${payment.registration.id}` : "/dashboard";

  return (
    <PageContainer width="narrow" className="py-10 sm:py-16">
      <div className="rounded-2xl border border-amber-500/30 bg-card p-8 shadow-card">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          <FlaskConical className="size-3.5" /> Simulatie (geen Mollie-key)
        </div>
        <h1 className="mt-4 text-2xl font-bold text-foreground">Betaling simuleren</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Dit scherm vervangt de iDEAL-/Mollie-pagina zolang er geen <code className="rounded bg-muted px-1">MOLLIE_API_KEY</code> is ingesteld. Kies wat de bank zou terugsturen.
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-4 text-sm">
          <dt className="text-muted-foreground">Omschrijving</dt>
          <dd className="font-medium text-foreground">{payment.description}</dd>
          <dt className="text-muted-foreground">Bedrag</dt>
          <dd className="font-medium text-foreground">{formatPrice(payment.amount, locale)}</dd>
          <dt className="text-muted-foreground">Status</dt>
          <dd className="font-mono text-foreground">{payment.status}</dd>
        </dl>
        <SimulatePaymentButtons paymentId={payment.id} returnPath={returnPath} alreadySettled={payment.status === "PAID" || payment.status === "FAILED" || payment.status === "CANCELED"} />
      </div>
    </PageContainer>
  );
}
