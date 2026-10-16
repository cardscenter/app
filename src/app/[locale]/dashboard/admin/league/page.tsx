import { Trophy, Award } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin";
import { listEnabledGames } from "@/lib/games-server";
import { ensureLeagueDefaults, getActiveSeason, getStandings } from "@/lib/community/league";
import { utcToShopWallClock } from "@/lib/shop-events/format";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { SeasonCard, BadgeCard } from "@/components/admin/league-admin";
import { StandingsTable } from "@/components/community/standings-table";

export const dynamic = "force-dynamic";

/** Admin: league-seizoenen (punten-regels, status) en badges. Uitslagen voert staff in. */
export default async function AdminLeaguePage() {
  await requireAdminPage();
  await ensureLeagueDefaults();
  const [seasons, badges, games, active] = await Promise.all([
    prisma.leagueSeason.findMany({ orderBy: { startsAt: "desc" }, include: { _count: { select: { results: true } } } }),
    prisma.leagueBadge.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { awards: true } } } }),
    listEnabledGames(),
    getActiveSeason(),
  ]);
  const players = await prisma.leagueResult.groupBy({ by: ["seasonId", "userId"] });
  const playersBySeason = new Map<string, number>();
  for (const p of players) playersBySeason.set(p.seasonId, (playersBySeason.get(p.seasonId) ?? 0) + 1);
  const standings = active ? await getStandings(active.id, null) : [];

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="League"
        subtitle="Seizoenen met hun puntenregels en de badges die spelers kunnen verdienen. Uitslagen voert staff in via Uitslagen invoeren."
        action={
          <Link href="/dashboard/staff/league" className="inline-flex items-center gap-1.5 cc-pill cc-grad px-4 py-2 text-sm font-semibold text-primary-foreground">
            <Trophy className="size-4" /> Uitslagen invoeren
          </Link>
        }
      />

      <DashboardSection title="Seizoenen" icon={<Trophy className="size-5" />} description="Eén seizoen tegelijk actief. Afsluiten bevriest de ranglijst." variant="plain">
        <div className="space-y-3">
          {seasons.map((s) => (
            <SeasonCard
              key={s.id}
              games={games.map((g) => ({ key: g.key, name: g.name }))}
              row={{
                id: s.id,
                name: s.name,
                game: s.game,
                description: s.description,
                startsAt: utcToShopWallClock(s.startsAt).date,
                endsAt: utcToShopWallClock(s.endsAt).date,
                status: s.status,
                pointsWin: s.pointsWin,
                pointsDraw: s.pointsDraw,
                pointsLoss: s.pointsLoss,
                pointsParticipation: s.pointsParticipation,
                resultCount: s._count.results,
                playerCount: playersBySeason.get(s.id) ?? 0,
              }}
            />
          ))}
          <SeasonCard row={null} games={games.map((g) => ({ key: g.key, name: g.name }))} startOpen={seasons.length === 0} />
        </div>
      </DashboardSection>

      {active && (
        <DashboardSection title={`Ranglijst ${active.name}`} description="Volledige lijst, inclusief spelers die zich publiek verborgen hebben." contentClassName="p-0">
          {standings.length === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground">Nog geen uitslagen.</p> : <StandingsTable rows={standings} compact />}
        </DashboardSection>
      )}

      <DashboardSection title="Badges" icon={<Award className="size-5" />} description="De poorten van Hulst. Namen zijn placeholders tot de definitieve lijst er is; sleutel en voorwaarde blijven werken." variant="plain">
        <div className="space-y-3">
          {badges.map((b) => (
            <BadgeCard key={b.id} row={{ ...b, awardCount: b._count.awards }} />
          ))}
          <BadgeCard row={null} />
        </div>
      </DashboardSection>
    </div>
  );
}
