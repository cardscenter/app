import "server-only";
import { listShopEvents, type ShopEventListItem } from "@/lib/shop-events/queries";
import { listPublishedNews, type NewsListItem } from "@/lib/community/news";
import { getActiveSeason, getStandings, type StandingView } from "@/lib/community/league";
import { getHubSettings, type HubSettings } from "@/lib/app-config";
import { listEnabledGames } from "@/lib/games-server";
import type { GameDefinition } from "@/lib/games";
import { listApprovedTestimonials, type TestimonialView } from "@/lib/community/testimonials";
import { getLoyaltySummary, type LoyaltySummary } from "@/lib/community/loyalty";

export interface LandingData {
  events: ShopEventListItem[];
  news: NewsListItem[];
  games: GameDefinition[];
  season: { id: string; name: string } | null;
  standings: StandingView[];
  settings: HubSettings;
  /** Uitgelichte ervaringen (design-pass Fase C); de rij toont vanaf drie. */
  testimonials: TestimonialView[];
  /** Eigen stempelkaart + spaarpunten van de ingelogde speler (null = uitgelogd). */
  loyalty: LoyaltySummary | null;
}

/**
 * Alle data voor de nieuwe homepage in één keer (design-pass 2026-10).
 * Alles is al publiek elders op de site; hier alleen gebundeld en gecapt.
 */
export async function getLandingData(viewerId: string | null): Promise<LandingData> {
  const [events, news, games, season, settings, testimonials, loyalty] = await Promise.all([
    listShopEvents({}),
    listPublishedNews(6),
    listEnabledGames(),
    getActiveSeason(),
    getHubSettings(),
    listApprovedTestimonials({ featuredOnly: true, take: 6 }),
    viewerId ? getLoyaltySummary(viewerId) : Promise.resolve(null),
  ]);
  const upcoming = events.filter((e) => e.status === "PUBLISHED");
  const standings: StandingView[] = season ? await getStandings(season.id, viewerId) : [];
  return {
    events: upcoming.slice(0, 8),
    news,
    games,
    season: season ? { id: season.id, name: season.name } : null,
    standings: standings.slice(0, 5),
    settings,
    testimonials,
    loyalty,
  };
}
