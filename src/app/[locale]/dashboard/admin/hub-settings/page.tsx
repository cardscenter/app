import { Settings2 } from "lucide-react";
import { getHubSettings } from "@/lib/app-config";
import { requireAdminPage } from "@/lib/admin";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { HubSettingsForm } from "@/components/admin/hub-settings-form";

export const dynamic = "force-dynamic";

/** Admin: winkel-instellingen (pand-maximum, openingstijden, annuleringsbeleid, event-info). */
export default async function HubSettingsPage() {
  await requireAdminPage();
  const settings = await getHubSettings();
  return (
    <div className="space-y-6">
      <DashboardPageHeader title="Winkel-instellingen" subtitle="Algemene instellingen voor de hub. Het pand-maximum is een harde bovengrens voor elk event; de teksten staan onder elk event en in de mails." />
      <DashboardSection title="Instellingen" icon={<Settings2 className="size-5" />}>
        <HubSettingsForm initial={settings} />
      </DashboardSection>
    </div>
  );
}
