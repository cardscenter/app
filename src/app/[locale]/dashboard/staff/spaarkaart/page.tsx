import { setRequestLocale } from "next-intl/server";
import { requireStaffPage } from "@/lib/roles-server";
import { getHubSettings } from "@/lib/app-config";
import { fullCardReward } from "@/lib/community/config";
import { formatPrice } from "@/lib/shop-events/format";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { LoyaltyDesk } from "@/components/staff/loyalty-desk";

export const dynamic = "force-dynamic";

/** Staff: stempels en spaarpunten aan de kassa (geven, bijschrijven, inwisselen). Hardcoded NL. */
export default async function StaffLoyaltyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaffPage(locale);
  const s = await getHubSettings();
  const r = fullCardReward(s);
  const reward = [r.points > 0 ? `${r.points} bonuspunten (${formatPrice(r.euro)} korting op eten)` : null, r.extra || null].filter(Boolean).join(" + ") || "geen beloning ingesteld";
  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Spaarkaart en punten"
        subtitle={`Check-ins geven automatisch een stempel en ${s.pointsPerCheckIn} punten (1 punt = 1 cent korting op eten). Hier geef je handmatig een stempel of punten, of wissel je punten in. Volle kaart (${s.stampsPerCard} stempels): ${reward}.`}
      />
      <LoyaltyDesk />
    </div>
  );
}
