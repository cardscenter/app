import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin";
import { listEnabledGames } from "@/lib/games-server";
import { ensureEventTypes } from "@/lib/shop-events/registrations";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { EventTypeCard } from "@/components/admin/event-type-form";

export const dynamic = "force-dynamic";

/** Admin: event-types met standaardwaarden en leeftijdsdivisies per type. */
export default async function AdminEventTypesPage() {
  await requireAdminPage();
  await ensureEventTypes();
  const [types, games] = await Promise.all([
    prisma.eventType.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { events: true } } } }),
    listEnabledGames(),
  ]);
  const gameOptions = games.map((g) => ({ key: g.key, name: g.name }));
  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Event-types"
        subtitle="Soorten events met hun standaardprijs, capaciteit en leeftijdsdivisies (op geboortejaar). Een nieuw event neemt deze waarden over; per event kun je ze nog aanpassen."
      />
      <div className="space-y-3">
        {types.map((t) => (
          <EventTypeCard key={t.id} games={gameOptions} row={{ ...t, eventCount: t._count.events }} />
        ))}
        <EventTypeCard row={null} games={gameOptions} />
      </div>
    </div>
  );
}
