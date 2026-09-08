import { prisma } from "@/lib/prisma";
import { AppConfigEditor } from "@/components/admin/app-config-editor";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";

export default async function AdminConfigPage() {
  const records = await prisma.appConfig.findMany({
    orderBy: { key: "asc" },
  });

  const entries = records.map((r) => ({
    key: r.key,
    value: r.value,
    updatedAt: r.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="AppConfig"
        subtitle="Key-value records voor runtime-instellingen. Wijzigingen worden direct van kracht en gelogd in audit log. De waarde moet geldige JSON zijn (kan een primitive, object of array zijn)."
      />
      <AppConfigEditor entries={entries} />
    </div>
  );
}
