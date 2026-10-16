import "server-only";
import { prisma } from "@/lib/prisma";
import { listShopEvents, type ShopEventListItem } from "@/lib/shop-events/queries";
import { listPublishedNews, type NewsListItem } from "@/lib/community/news";
import { getActiveSeason, getStandings, type StandingView } from "@/lib/community/league";
import { getHubSettings, type HubSettings } from "@/lib/app-config";
import { listEnabledGames } from "@/lib/games-server";
import type { GameDefinition } from "@/lib/games";

export interface LandingData {
  events: ShopEventListItem[];
  news: NewsListItem[];
  games: GameDefinition[];
  season: { id: string; name: string } | null;
  standings: StandingView[];
  settings: HubSettings;
  counts: {
    members: number;
    upcomingEvents: number;
    seasonResults: number;
    seasonPlayers: number;
  };
}

/**
 * Alle data voor de nieuwe homepage in één keer (design-pass 2026-10).
 * Alles is al publiek elders op de site; hier alleen gebundeld en gecapt.
 */
export async function getLandingData(viewerId: string | null): Promise<LandingData> {
  const [events, news, games, season, settings, members] = await Promise.all([
    listShopEvents({}),
    listPublishedNews(6),
    listEnabledGames(),
    getActiveSeason(),
    getHubSettings(),
    prisma.user.count({ where: { deletedAt: null } }),
  ]);
  const upcoming = events.filter((e) => e.status === "PUBLISHED");
  let standings: StandingView[] = [];
  let seasonResults = 0;
  if (season) {
    const [rows, results] = await Promise.all([
      getStandings(season.id, viewerId),
      prisma.leagueResult.count({ where: { seasonId: season.id } }),
    ]);
    standings = rows;
    seasonResults = results;
  }
  return {
    events: upcoming.slice(0, 8),
    news,
    games,
    season: season ? { id: season.id, name: season.name } : null,
    standings: standings.slice(0, 5),
    settings,
    counts: {
      members,
      upcomingEvents: upcoming.length,
      seasonResults,
      seasonPlayers: standings.length,
    },
  };
}
