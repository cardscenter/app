import { Coins } from "lucide-react";
import { requireAdminPage } from "@/lib/admin";
import { getBulkPricing } from "@/lib/buyback-pricing-db";
import { MINIMUM_BULK_VALUE } from "@/lib/buyback-pricing";
import { RETURN_FEE_EUR } from "@/lib/buyback-status";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { BulkPricingAdmin } from "@/components/admin/bulk-pricing-admin";

export const dynamic = "force-dynamic";

/** Admin: bulk-inkooptarieven (Community Hub, Fase 6). Wijzigingen gelden voor nieuwe aanvragen; lopende aanvragen houden hun snapshot. */
export default async function AdminBuybackPricingPage() {
  await requireAdminPage();
  const rows = await getBulkPricing({ includeDisabled: true });
  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Inkooptarieven bulk"
        subtitle={`Prijs per stuk per categorie. Geldt voor nieuwe aanvragen; een ingediende aanvraag houdt de prijs van dat moment. Minimum per aanvraag €${MINIMUM_BULK_VALUE.toFixed(2)}, retourkosten €${RETURN_FEE_EUR.toFixed(2)} (vast in de code).`}
      />
      <DashboardSection title="Tarieven" icon={<Coins className="size-5" />} contentClassName="p-0">
        <BulkPricingAdmin rows={rows} />
      </DashboardSection>
    </div>
  );
}
