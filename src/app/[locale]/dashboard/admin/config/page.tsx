import { prisma } from "@/lib/prisma";
import { AppConfigEditor } from "@/components/admin/app-config-editor";

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
      <div>
        <h1 className="text-2xl font-bold">AppConfig</h1>
        <p className="text-sm text-muted-foreground">
          Key-value records voor runtime-instellingen. Wijzigingen worden direct van kracht en gelogd in audit log.
          De waarde moet geldige JSON zijn (kan een primitive, object of array zijn).
        </p>
      </div>
      <AppConfigEditor entries={entries} />
    </div>
  );
}
