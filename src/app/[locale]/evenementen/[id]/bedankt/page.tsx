import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageContainer } from "@/components/layout/page-container";
import { ReturnStatus } from "@/components/shop-events/return-status";

export const dynamic = "force-dynamic";

/**
 * Terugkeer-pagina na de Mollie-checkout (of de simulatie). De client-
 * component vraagt de status op (en synct bij Mollie), de webhook blijft
 * leidend. Toont ticket, "nog niet betaald" met betaalknop, of mislukt.
 */
export default async function ThankYouPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ r?: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { r } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login?callbackUrl=/evenementen/${id}`);
  if (!r) redirect(`/${locale}/evenementen/${id}`);

  const reg = await prisma.eventRegistration.findUnique({
    where: { id: r },
    select: { userId: true, eventId: true, event: { select: { title: true } } },
  });
  if (!reg || reg.userId !== session.user.id || reg.eventId !== id) redirect(`/${locale}/evenementen/${id}`);

  return (
    <PageContainer width="narrow" className="py-10 sm:py-16">
      <ReturnStatus registrationId={r} eventId={id} eventTitle={reg.event.title} locale={locale} />
    </PageContainer>
  );
}
