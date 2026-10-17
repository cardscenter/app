import { setRequestLocale } from "next-intl/server";
import { Trophy, AlertTriangle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/roles-server";
import { getActiveSeason, getEventResultSheet } from "@/lib/community/league";
import { formatEventDateShort, formatEventTime } from "@/lib/shop-events/format";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { ResultSheet } from "@/components/staff/result-sheet";
import { PILL_BTN } from "@/components/ploy/tile-styles";

export const dynamic = "force-dynamic";

/**
 * Staff: uitslagen invoeren per event (W/V/G per deelnemer). Kies een event
 * dat meetelt voor de league; standaard het meest recente. Hardcoded NL.
 */
export default async function StaffLeaguePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ event?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaffPage(locale);
  const { event: eventParam } = await searchParams;
  const season = await getActiveSeason();
  const now = new Date();
  const events = await prisma.shopEvent.findMany({
    where: { countsForLeague: true, status: { in: ["PUBLISHED", "COMPLETED"] }, startsAt: { gte: new Date(now.getTime() - 45 * 24 * 3600_000), lte: new Date(now.getTime() + 24 * 3600_000) } },
    orderBy: { startsAt: "desc" },
    select: { id: true, title: true, startsAt: true, status: true },
    take: 40,
  });
  const selectedId = eventParam === "los" ? null : eventParam && events.some((e) => e.id === eventParam) ? eventParam : events[0]?.id ?? null;
  const selected = events.find((e) => e.id === selectedId) ?? null;
  const rows = season ? await getEventResultSheet(selectedId, season.id) : [];

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Uitslagen invoeren"
        subtitle={season ? `Seizoen ${season.name}: winst ${season.pointsWin}, gelijk ${season.pointsDraw}, verlies ${season.pointsLoss}, meedoen ${season.pointsParticipation} punten.` : "Er is geen actief seizoen. Een admin maakt er een aan onder Community > League."}
        action={
          <Link href="/league" className={PILL_BTN}>
            <Trophy className="size-4" /> Ranglijst
          </Link>
        }
      />

      {!season ? (
        <EmptyState icon={AlertTriangle} title="Geen actief seizoen" description="Uitslagen kunnen alleen in een actief seizoen worden ingevoerd." />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {events.map((e) => (
              <Link key={e.id} href={`/dashboard/staff/league?event=${e.id}`} className={`cc-pill inline-flex h-9 items-center px-4 text-sm font-semibold transition-colors ${e.id === selectedId ? "bg-foreground text-white" : "bg-white text-foreground/70 hover:text-foreground"}`}>
                {formatEventDateShort(e.startsAt, locale)} {formatEventTime(e.startsAt)} · {e.title}
              </Link>
            ))}
            <Link href="/dashboard/staff/league?event=los" className={`cc-pill inline-flex h-9 items-center px-4 text-sm font-semibold transition-colors ${selectedId === null && eventParam === "los" ? "bg-foreground text-white" : "bg-white text-foreground/70 hover:text-foreground"}`}>
              Los resultaat (zonder event)
            </Link>
          </div>
          {events.length === 0 && eventParam !== "los" && (
            <p className="text-sm text-muted-foreground">Geen league-events in de afgelopen 45 dagen. Zet bij een event &ldquo;Telt mee voor de league&rdquo; aan, of voer een los resultaat in.</p>
          )}
          <DashboardSection title={selected ? selected.title : "Los resultaat"} description={selected ? `${formatEventDateShort(selected.startsAt, locale)} ${formatEventTime(selected.startsAt)}. Deelnemers met ticket staan er al; anderen voeg je toe.` : "Resultaten zonder event, bv. een inhaalpartij. Eén per speler per seizoen."} contentClassName="px-0 pb-0 pt-4 sm:px-0 sm:pb-0">
            <ResultSheet rows={rows} seasonId={season.id} eventId={selectedId} />
          </DashboardSection>
        </>
      )}
    </div>
  );
}
