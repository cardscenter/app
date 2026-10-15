import { notFound } from "next/navigation";
import { Users, Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin";
import { listEnabledGames } from "@/lib/games-server";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { StatCard } from "@/components/dashboard/ui/stat-card";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import { ShopEventForm } from "@/components/admin/shop-event-form";
import { ShopEventActions } from "@/components/admin/shop-event-actions";
import { ShopEventRegistrations } from "@/components/admin/shop-event-registrations";
import { getEventAvailability } from "@/lib/shop-events/registrations";
import { parseAgeDivisions, divisionLabel, SHOP_EVENT_STATUS_LABEL, type ShopEventStatus } from "@/lib/shop-events/config";
import { formatEventDate, formatEventTime, formatPrice } from "@/lib/shop-events/format";

export const dynamic = "force-dynamic";

const TONE: Record<string, "success" | "warning" | "neutral" | "danger"> = { PUBLISHED: "success", DRAFT: "warning", CANCELLED: "danger", COMPLETED: "neutral" };

export default async function AdminShopEventPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const event = await prisma.shopEvent.findUnique({
    where: { id },
    include: {
      type: { select: { ageDivisions: true, name: true } },
      registrations: {
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        include: { user: { select: { displayName: true, email: true, avatarUrl: true } }, payment: { select: { status: true } } },
      },
    },
  });
  if (!event) notFound();
  const [types, games, availability] = await Promise.all([
    prisma.eventType.findMany({ where: { OR: [{ enabled: true }, { id: event.typeId }] }, orderBy: { sortOrder: "asc" } }),
    listEnabledGames(),
    getEventAvailability(event),
  ]);
  const rules = parseAgeDivisions(event.type.ageDivisions);
  const active = event.registrations.filter((r) => ["CONFIRMED", "CHECKED_IN"].includes(r.status));
  const checkedIn = event.registrations.filter((r) => r.status === "CHECKED_IN").length;
  const revenue = event.registrations.filter((r) => r.payment?.status === "PAID" || (["CONFIRMED", "CHECKED_IN"].includes(r.status) && !r.payment)).reduce((s, r) => s + r.amount, 0);
  const editable = event.status === "DRAFT" || event.status === "PUBLISHED";

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={event.title}
        subtitle={`${formatEventDate(event.startsAt)}, ${formatEventTime(event.startsAt)} - ${formatEventTime(event.endsAt)} · ${event.type.name}`}
        backHref="/dashboard/admin/events"
        backLabel="Winkel-events"
        action={<StatusBadge tone={TONE[event.status] ?? "neutral"}>{SHOP_EVENT_STATUS_LABEL[event.status as ShopEventStatus] ?? event.status}</StatusBadge>}
      />
      {event.status === "CANCELLED" && event.cancelReason && (
        <p className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">Geannuleerd: {event.cancelReason}</p>
      )}
      <ShopEventActions eventId={event.id} status={event.status} endsAtIso={event.endsAt.toISOString()} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Ingeschreven" value={availability.capacity ? `${active.length} / ${availability.capacity}` : active.length} icon={Users} hint={availability.spotsLeft === null ? "Onbeperkt" : `${availability.spotsLeft} plekken over`} />
        <StatCard label="Wachtlijst" value={availability.waitlistCount} />
        <StatCard label="Ingecheckt" value={checkedIn} />
        <StatCard label="Omzet" value={formatPrice(revenue)} hint={`Prijs ${formatPrice(event.price)}`} />
      </div>

      <DashboardSection title="Inschrijvingen" icon={<Users className="size-5" />} contentClassName="p-0">
        <ShopEventRegistrations
          eventId={event.id}
          canAdd={event.status === "PUBLISHED"}
          rows={event.registrations.map((r) => ({
            id: r.id,
            status: r.status,
            ticketCode: r.ticketCode,
            displayName: r.user.displayName,
            email: r.user.email,
            avatarUrl: r.user.avatarUrl,
            division: divisionLabel(r.divisionKey, rules),
            amount: r.amount,
            paymentStatus: r.payment?.status ?? null,
            createdAt: r.createdAt.toISOString(),
            checkedInAt: r.checkedInAt?.toISOString() ?? null,
            note: r.note,
          }))}
        />
      </DashboardSection>

      {editable && (
        <DashboardSection title="Bewerken" icon={<Pencil className="size-5" />}>
          <ShopEventForm
            types={types.map((t) => ({ id: t.id, name: t.name, game: t.game, defaultPrice: t.defaultPrice, defaultCapacity: t.defaultCapacity, countsForLeague: t.countsForLeague, countsForStampCard: t.countsForStampCard }))}
            games={games.map((g) => ({ key: g.key, name: g.name }))}
            initial={{
              id: event.id,
              typeId: event.typeId,
              title: event.title,
              description: event.description ?? "",
              game: event.game ?? "",
              startsAt: event.startsAt.toISOString(),
              endsAt: event.endsAt.toISOString(),
              registrationOpensAt: event.registrationOpensAt?.toISOString() ?? null,
              registrationDeadline: event.registrationDeadline?.toISOString() ?? null,
              price: event.price,
              capacity: event.capacity,
              minAge: event.minAge,
              maxAge: event.maxAge,
              underTwelveWithAdult: event.underTwelveWithAdult,
              waitlistEnabled: event.waitlistEnabled,
              countsForLeague: event.countsForLeague,
              countsForStampCard: event.countsForStampCard,
              showParticipants: event.showParticipants,
              cancellationHours: event.cancellationHours,
              refundPolicy: event.refundPolicy ?? "",
              coverImage: event.coverImage,
              status: event.status,
              hasRegistrations: event.registrations.some((r) => ["RESERVED", "CONFIRMED", "OFFERED", "CHECKED_IN"].includes(r.status)),
            }}
          />
        </DashboardSection>
      )}
    </div>
  );
}
