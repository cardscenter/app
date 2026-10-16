import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Ticket } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { getMyTickets } from "@/lib/shop-events/queries";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { TicketCard } from "@/components/shop-events/ticket-card";
import { formatShopAddress, PLATFORM } from "@/lib/platform-config";

const BTN = "inline-flex items-center gap-1.5 cc-pill cc-grad px-4 py-2 text-sm font-semibold text-primary-foreground";
const BTN_OUTLINE = "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted";

export const dynamic = "force-dynamic";

export default async function MyTicketsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login?callbackUrl=/dashboard/tickets`);
  const t = await getTranslations("shopEvents");
  const { upcoming, past } = await getMyTickets(session.user.id);
  const address = `${PLATFORM.shop.name}, ${formatShopAddress()}`;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={t("myTickets")}
        subtitle={t("myTicketsSubtitle")}
        action={
          <Link href="/evenementen" className={BTN_OUTLINE}>
            {t("browseEvents")}
          </Link>
        }
      />

      {upcoming.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title={t("noTicketsTitle")}
          description={t("noTicketsBody")}
          action={
            <Link href="/evenementen" className={BTN}>
              {t("browseEvents")}
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {upcoming.map((tk) => (
            <TicketCard key={tk.id} ticket={tk} locale={locale} shopAddress={address} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("pastTickets")}</h2>
          <div className="space-y-3 opacity-80">
            {past.map((tk) => (
              <TicketCard key={tk.id} ticket={tk} locale={locale} shopAddress={address} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
