import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getTicketByCode } from "@/lib/shop-events/queries";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { TicketCard } from "@/components/shop-events/ticket-card";
import { formatShopAddress, PLATFORM } from "@/lib/platform-config";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({ params }: { params: Promise<{ locale: string; code: string }> }) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login?callbackUrl=/dashboard/tickets/${code}`);
  const t = await getTranslations("shopEvents");
  const ticket = await getTicketByCode(session.user.id, code.toUpperCase());
  if (!ticket) notFound();

  return (
    <div className="space-y-6">
      <DashboardPageHeader title={t("ticketTitle")} subtitle={t("ticketSubtitle")} backHref="/dashboard/tickets" backLabel={t("myTickets")} />
      <TicketCard ticket={ticket} locale={locale} variant="full" shopAddress={`${PLATFORM.shop.name}, ${formatShopAddress()}`} />
    </div>
  );
}
