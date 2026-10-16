import "server-only";
import { prisma } from "@/lib/prisma";
import { listShopEvents, type ShopEventListItem } from "@/lib/shop-events/queries";
import { listPublishedNews, type NewsListItem } from "@/lib/community/news";
import { getActiveSeason, getStandings, type StandingView } from "@/lib/community/league";
import { getHubSettings, type HubSettings } from "@/lib/app-config";
import { listEnabledGames } from "@/lib/games-server";
import type { GameDefinition } from "@/lib/games";
import { listApprovedTestimonials, type TestimonialView } from "@/lib/community/testimonials";

export interface LandingData {
  events: ShopEventListItem[];
  news: NewsListItem[];
  games: GameDefinition[];
  season: { id: string; name: string } | null;
  standings: StandingView[];
  settings: HubSettings;
  /** Uitgelichte ervaringen (design-pass Fase C); de rij toont vanaf drie. */
  testimonials: TestimonialView[];
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
  const [events, news, games, season, settings, members, testimonials] = await Promise.all([
    listShopEvents({}),
    listPublishedNews(6),
    listEnabledGames(),
    getActiveSeason(),
    getHubSettings(),
    prisma.user.count({ where: { deletedAt: null } }),
    listApprovedTestimonials({ featuredOnly: true, take: 6 }),
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
    testimonials,
    counts: {
      members,
      upcomingEvents: upcoming.length,
      seasonResults,
      seasonPlayers: standings.length,
    },
  };
}
