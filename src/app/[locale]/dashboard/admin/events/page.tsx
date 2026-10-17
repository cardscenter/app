import { CalendarDays, Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import { EventTypePill } from "@/components/shop-events/event-type-pill";
import { ensureEventTypes } from "@/lib/shop-events/registrations";
import { SHOP_EVENT_STATUS_LABEL, type ShopEventStatus } from "@/lib/shop-events/config";
import { formatEventDateShort, formatEventTime, formatPrice } from "@/lib/shop-events/format";
import { PILL_RED, TABLE_CELL, TABLE_HEAD } from "@/components/ploy/tile-styles";
import { cn } from "@/lib/utils";

const BTN = PILL_RED;
const TAB = "cc-pill inline-flex h-9 items-center px-4 text-sm font-semibold transition-colors";
const TAB_ON = "bg-foreground text-white";
const TAB_OFF = "bg-white text-foreground/70 hover:text-foreground";

export const dynamic = "force-dynamic";

const TONE: Record<string, "success" | "warning" | "neutral" | "danger"> = { PUBLISHED: "success", DRAFT: "warning", CANCELLED: "danger", COMPLETED: "neutral" };

/** Admin: overzicht winkel-events (komend + afgelopen). */
export default async function AdminEventsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdminPage();
  const { tab } = await searchParams;
  await ensureEventTypes();
  const now = new Date();
  const past = tab === "afgelopen";
  const events = await prisma.shopEvent.findMany({
    where: past ? { endsAt: { lt: now } } : { endsAt: { gte: now } },
    orderBy: { startsAt: past ? "desc" : "asc" },
    include: { type: { select: { name: true, color: true } }, _count: { select: { registrations: { where: { status: { in: ["CONFIRMED", "CHECKED_IN"] } } } } } },
    take: 100,
  });
  const waitlists = await prisma.eventRegistration.groupBy({ by: ["eventId"], where: { eventId: { in: events.map((e) => e.id) }, status: "WAITLIST" }, _count: { _all: true } });
  const waitBy = new Map(waitlists.map((w) => [w.eventId, w._count._all]));

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Winkel-events"
        subtitle="Toernooien, league-avonden en pre-releases in de winkel. Een event is pas zichtbaar na publiceren."
        action={
          <Link href="/dashboard/admin/events/nieuw" className={BTN}>
            <Plus className="size-4" /> Nieuw event
          </Link>
        }
      />
      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/admin/events" className={`${TAB} ${!past ? TAB_ON : TAB_OFF}`}>Komend</Link>
        <Link href={{ pathname: "/dashboard/admin/events", query: { tab: "afgelopen" } }} className={`${TAB} ${past ? TAB_ON : TAB_OFF}`}>Afgelopen</Link>
      </div>

      {events.length === 0 ? (
        <EmptyState icon={CalendarDays} title={past ? "Nog geen afgelopen events" : "Nog geen events gepland"} description="Maak een event aan; het staat als concept tot je het publiceert." action={<Link href="/dashboard/admin/events/nieuw" className={BTN}>Nieuw event</Link>} />
      ) : (
        <DashboardSection title={past ? "Afgelopen" : "Komend"} contentClassName="px-0 pb-0 pt-4 sm:px-0 sm:pb-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={cn(TABLE_HEAD, "bg-[var(--background)]")}>
                <tr>
                  <th className={TABLE_CELL}>Datum</th>
                  <th className={TABLE_CELL}>Event</th>
                  <th className={TABLE_CELL}>Status</th>
                  <th className={cn(TABLE_CELL, "text-right")}>Prijs</th>
                  <th className={cn(TABLE_CELL, "text-right")}>Ingeschreven</th>
                  <th className={cn(TABLE_CELL, "text-right")}>Wachtlijst</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.map((e) => (
                  <tr key={e.id} className="transition-colors hover:bg-[var(--background)]/60">
                    <td className={cn(TABLE_CELL, "whitespace-nowrap text-muted-foreground")}>
                      {formatEventDateShort(e.startsAt)} {formatEventTime(e.startsAt)}
                    </td>
                    <td className={TABLE_CELL}>
                      <Link href={`/dashboard/admin/events/${e.id}`} className="font-semibold text-foreground hover:text-primary">{e.title}</Link>
                      <div className="mt-1"><EventTypePill name={e.type.name} color={e.type.color} /></div>
                    </td>
                    <td className={TABLE_CELL}><StatusBadge tone={TONE[e.status] ?? "neutral"}>{SHOP_EVENT_STATUS_LABEL[e.status as ShopEventStatus] ?? e.status}</StatusBadge></td>
                    <td className={cn(TABLE_CELL, "text-right")}>{formatPrice(e.price)}</td>
                    <td className={cn(TABLE_CELL, "text-right tabular-nums")}>{e._count.registrations}{e.capacity ? ` / ${e.capacity}` : ""}</td>
                    <td className={cn(TABLE_CELL, "text-right tabular-nums text-muted-foreground")}>{waitBy.get(e.id) ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSection>
      )}
    </div>
  );
}
