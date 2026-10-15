import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin";
import { listEnabledGames } from "@/lib/games-server";
import { ensureEventTypes } from "@/lib/shop-events/registrations";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { ShopEventForm } from "@/components/admin/shop-event-form";

export const dynamic = "force-dynamic";

export default async function NewShopEventPage() {
  await requireAdminPage();
  await ensureEventTypes();
  const [types, games] = await Promise.all([
    prisma.eventType.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } }),
    listEnabledGames(),
  ]);
  const first = types[0];
  return (
    <div className="space-y-6">
      <DashboardPageHeader title="Nieuw event" subtitle="Wordt opgeslagen als concept. Publiceren doe je op de detailpagina." backHref="/dashboard/admin/events" backLabel="Winkel-events" />
      <DashboardSection title="Gegevens">
        <ShopEventForm
          types={types.map((t) => ({ id: t.id, name: t.name, game: t.game, defaultPrice: t.defaultPrice, defaultCapacity: t.defaultCapacity, countsForLeague: t.countsForLeague, countsForStampCard: t.countsForStampCard }))}
          games={games.map((g) => ({ key: g.key, name: g.name }))}
          initial={{
            typeId: first?.id ?? "",
            title: "",
            description: "",
            game: first?.game ?? "",
            startsAt: null,
            endsAt: null,
            registrationOpensAt: null,
            registrationDeadline: null,
            price: first?.defaultPrice ?? 0,
            capacity: first?.defaultCapacity ?? null,
            minAge: null,
            maxAge: null,
            underTwelveWithAdult: true,
            waitlistEnabled: true,
            countsForLeague: first?.countsForLeague ?? false,
            countsForStampCard: first?.countsForStampCard ?? true,
            showParticipants: true,
            cancellationHours: 24,
            refundPolicy: "",
            coverImage: null,
          }}
        />
      </DashboardSection>
    </div>
  );
}
