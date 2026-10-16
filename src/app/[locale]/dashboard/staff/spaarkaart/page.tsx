import { setRequestLocale } from "next-intl/server";
import { requireStaffPage } from "@/lib/roles-server";
import { getHubSettings } from "@/lib/app-config";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { LoyaltyDesk } from "@/components/staff/loyalty-desk";

export const dynamic = "force-dynamic";

/** Staff: stempels en spaarpunten aan de kassa (geven, bijschrijven, inwisselen). Hardcoded NL. */
export default async function StaffLoyaltyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaffPage(locale);
  const s = await getHubSettings();
  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Spaarkaart en punten"
        subtitle={`Check-ins geven automatisch een stempel en ${s.pointsPerCheckIn} punten. Hier geef je handmatig een stempel of punten, en wissel je punten in aan de kassa. Volle kaart (${s.stampsPerCard} stempels): ${s.stampReward}`}
      />
      <LoyaltyDesk />
    </div>
  );
}
