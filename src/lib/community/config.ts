/**
 * League, stempelkaart en spaarpunten (Community Hub, Fase 5). Puur bestand.
 *
 * - League: staff voert per event per speler winst/verlies/gelijk in; de
 *   seizoensformule rekent punten uit (opgeslagen op de uitslag). Ranglijst =
 *   som per seizoen. Alleen spelers met `showOnLeaderboards` staan publiek.
 * - Badges ("poorten van Hulst"): drempels per criterium; namen zijn
 *   placeholders tot Youri ze aanlevert.
 * - Stempelkaart: 1 stempel per check-in op een event met `countsForStampCard`;
 *   volle kaart = beloning aan de bar. Spaarpunten: per check-in, inwisselen
 *   door staff aan de kassa. Nooit geld.
 */

export const BADGE_CRITERIA = ["SEASON_POINTS", "SEASON_EVENTS", "SEASON_WINS", "TOTAL_EVENTS", "TOTAL_STAMPS"] as const;
export type BadgeCriterion = (typeof BADGE_CRITERIA)[number];

export const BADGE_CRITERION_LABEL: Record<BadgeCriterion, string> = {
  SEASON_POINTS: "League-punten in één seizoen",
  SEASON_EVENTS: "Events gespeeld in één seizoen",
  SEASON_WINS: "Gewonnen partijen in één seizoen",
  TOTAL_EVENTS: "Events gespeeld (totaal)",
  TOTAL_STAMPS: "Stempels verzameld (totaal)",
};

/** Placeholder-badges (poorten van Hulst). Volgorde = oplopend prestige. */
export const DEFAULT_BADGES: Array<{ key: string; name: string; description: string; color: string; criterion: BadgeCriterion; threshold: number; sortOrder: number }> = [
  { key: "bagijnepoort", name: "Bagijnepoort", description: "Je eerste league-avond gespeeld.", color: "emerald", criterion: "TOTAL_EVENTS", threshold: 1, sortOrder: 10 },
  { key: "dubbele-poort", name: "Dubbele Poort", description: "Vijf events gespeeld.", color: "blue", criterion: "TOTAL_EVENTS", threshold: 5, sortOrder: 20 },
  { key: "gentsepoort", name: "Gentsepoort", description: "Tien overwinningen in één seizoen.", color: "amber", criterion: "SEASON_WINS", threshold: 10, sortOrder: 30 },
  { key: "keldermanspoort", name: "Keldermanspoort", description: "Vijftig league-punten in één seizoen.", color: "violet", criterion: "SEASON_POINTS", threshold: 50, sortOrder: 40 },
  { key: "stadspoort", name: "Stadspoort", description: "Een volle stempelkaart (tien stempels).", color: "rose", criterion: "TOTAL_STAMPS", threshold: 10, sortOrder: 50 },
];

export interface SeasonPointRules {
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  pointsParticipation: number;
}

export interface ResultInput {
  wins: number;
  losses: number;
  draws: number;
  bonusPoints?: number;
}

/** Punten voor één uitslag volgens de seizoensregels. */
export function calcResultPoints(r: ResultInput, rules: SeasonPointRules): number {
  const w = Math.max(0, Math.floor(r.wins || 0));
  const l = Math.max(0, Math.floor(r.losses || 0));
  const d = Math.max(0, Math.floor(r.draws || 0));
  return w * rules.pointsWin + d * rules.pointsDraw + l * rules.pointsLoss + rules.pointsParticipation + Math.floor(r.bonusPoints || 0);
}

export interface StandingRow {
  userId: string;
  points: number;
  events: number;
  wins: number;
  losses: number;
  draws: number;
}

/** Ranglijst-volgorde: punten, dan winst, dan minder events (efficiënter), dan naam door caller. */
export function compareStandings(a: StandingRow, b: StandingRow): number {
  return b.points - a.points || b.wins - a.wins || a.events - b.events;
}

/** Plaatsen met gedeelde posities (1, 2, 2, 4). */
export function rankStandings<T extends StandingRow>(rows: T[]): Array<T & { rank: number }> {
  const sorted = [...rows].sort(compareStandings);
  let rank = 0;
  let prev: StandingRow | null = null;
  return sorted.map((r, i) => {
    if (!prev || compareStandings(prev, r) !== 0) rank = i + 1;
    prev = r;
    return { ...r, rank };
  });
}

export interface LoyaltyDefaults {
  stampsPerCard: number;
  pointsPerCheckIn: number;
  pointsPerFullCard: number;
}
export const LOYALTY_DEFAULTS: LoyaltyDefaults = { stampsPerCard: 10, pointsPerCheckIn: 50, pointsPerFullCard: 500 };

/** Eén spaarpunt is één cent korting op eten. */
export const POINT_VALUE_EUR = 0.01;

/** Punten → euro (op centen afgerond). */
export function pointsToEuro(points: number): number {
  return Math.round(Math.max(0, points)) / 100;
}

export interface FullCardReward {
  /** Bonuspunten bij een volle kaart (0 = geen). */
  points: number;
  /** Wat die punten waard zijn aan eten. */
  euro: number;
  /** Optionele extra beloning uit de hub-instellingen (leeg = geen). */
  extra: string;
}

/**
 * Wat een volle stempelkaart oplevert: bonuspunten (= korting op eten) plus
 * een eventuele extra uit de instellingen. Elke plek maakt er zelf een zin van
 * in zijn eigen vertaling.
 */
export function fullCardReward(s: { pointsPerFullCard: number; stampReward: string }): FullCardReward {
  const points = Math.max(0, Math.round(s.pointsPerFullCard));
  return { points, euro: pointsToEuro(points), extra: s.stampReward.trim() };
}

/**
 * Eén zin voor de beloning: "<punten-tekst> + <extra>". De punten-tekst komt
 * uit de vertaling van de aanroeper; `none` als er geen punten en geen extra is.
 */
export function rewardSentence(r: FullCardReward, text: { points: (points: number, euro: number) => string; none: string }): string {
  const parts = [r.points > 0 ? text.points(r.points, r.euro) : null, r.extra || null].filter((p): p is string => !!p);
  return parts.length ? parts.join(" + ") : text.none;
}

/** Stempelkaart-weergave uit het totaal aantal stempels. */
export function stampCardState(totalStamps: number, stampsPerCard: number): { onCard: number; completedCards: number; remaining: number } {
  const per = Math.max(1, stampsPerCard);
  const completedCards = Math.floor(totalStamps / per);
  const onCard = totalStamps % per;
  return { onCard, completedCards, remaining: per - onCard };
}

/** Wordt bij deze stempel een kaart vol? (telt vanaf het nieuwe totaal) */
export function completesCard(totalAfter: number, stampsPerCard: number): boolean {
  const per = Math.max(1, stampsPerCard);
  return totalAfter > 0 && totalAfter % per === 0;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Platte tekst → alinea's (lege regel = nieuwe alinea). */
export function toParagraphs(body: string): string[] {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
