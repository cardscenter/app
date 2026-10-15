import { setRequestLocale } from "next-intl/server";
import { ScanLine, Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/roles-server";
import { Link } from "@/i18n/navigation";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { CheckInScanner } from "@/components/staff/check-in-scanner";
import { CheckInList } from "@/components/staff/check-in-list";
import { parseAgeDivisions, divisionLabel } from "@/lib/shop-events/config";
import { formatEventDateShort, formatEventTime } from "@/lib/shop-events/format";

export const dynamic = "force-dynamic";

/**
 * Staff: inchecken bij de deur. Kies een event (standaard het eerstvolgende
 * van vandaag), scan de QR of typ de code, en zie de deelnemerslijst met
 * handmatige check-in. Hardcoded NL (staff-only, zoals admin-pagina's).
 */
export default async function CheckInPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ event?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaffPage(locale); // belt-and-braces naast de proxy-307 en de layout
  const { event: eventParam } = await searchParams;
  const now = new Date();
  const windowStart = new Date(now.getTime() - 6 * 3600_000);
  const windowEnd = new Date(now.getTime() + 14 * 24 * 3600_000);

  const events = await prisma.shopEvent.findMany({
    where: { status: "PUBLISHED", endsAt: { gte: windowStart }, startsAt: { lte: windowEnd } },
    orderBy: { startsAt: "asc" },
    select: { id: true, title: true, startsAt: true, endsAt: true },
    take: 30,
  });
  const selectedId = eventParam && events.some((e) => e.id === eventParam) ? eventParam : events[0]?.id ?? null;
  const selected = selectedId
    ? await prisma.shopEvent.findUnique({
        where: { id: selectedId },
        include: {
          type: { select: { ageDivisions: true } },
          registrations: {
            where: { status: { in: ["CONFIRMED", "CHECKED_IN", "RESERVED", "OFFERED", "WAITLIST", "NO_SHOW"] } },
            orderBy: [{ status: "asc" }, { user: { displayName: "asc" } }],
            include: { user: { select: { displayName: true, firstName: true, lastName: true, avatarUrl: true, guardianPhone: true, dateOfBirth: true } } },
          },
        },
      })
    : null;
  const rules = selected ? parseAgeDivisions(selected.type.ageDivisions) : [];
  const rows = selected
    ? selected.registrations.map((r) => ({
        id: r.id,
        status: r.status,
        ticketCode: r.ticketCode,
        displayName: r.user.displayName,
        fullName: [r.user.firstName, r.user.lastName].filter(Boolean).join(" "),
        avatarUrl: r.user.avatarUrl,
        division: divisionLabel(r.divisionKey, rules),
        supervised: r.supervisedByAdult,
        guardianPhone: r.user.guardianPhone,
        checkedInAt: r.checkedInAt?.toISOString() ?? null,
        note: r.note,
      }))
    : [];
  const checkedIn = rows.filter((r) => r.status === "CHECKED_IN").length;
  const expected = rows.filter((r) => r.status === "CONFIRMED" || r.status === "CHECKED_IN").length;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Check-in"
        subtitle="Scan de QR op het ticket of typ de code. Buiten het venster van 3 uur voor tot 3 uur na het event vraagt de scanner om bevestiging."
        action={
          selected ? (
            <a href={`/api/staff/events/${selected.id}/export`} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
              <Download className="size-4" /> CSV
            </a>
          ) : undefined
        }
      />

      {events.length === 0 ? (
        <EmptyState icon={ScanLine} title="Geen events om in te checken" description="Er is de komende twee weken geen gepubliceerd event." />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {events.map((e) => (
              <Link
                key={e.id}
                href={{ pathname: "/dashboard/staff/check-in", query: { event: e.id } }}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${e.id === selectedId ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"}`}
              >
                {formatEventDateShort(e.startsAt)} {formatEventTime(e.startsAt)} · {e.title}
              </Link>
            ))}
          </div>

          {selected && (
            <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
              <DashboardSection title="Scanner" icon={<ScanLine className="size-5" />} description={`${checkedIn} van ${expected} ingecheckt`}>
                <CheckInScanner eventId={selected.id} eventTitle={selected.title} />
              </DashboardSection>
              <DashboardSection title={`Deelnemers · ${selected.title}`} contentClassName="p-0">
                <CheckInList rows={rows} />
              </DashboardSection>
            </div>
          )}
        </>
      )}
    </div>
  );
}
