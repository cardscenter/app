import { describe, expect, it } from "vitest";
import { calcResultPoints, rankStandings, stampCardState, completesCard, slugify, toParagraphs, DEFAULT_BADGES, BADGE_CRITERIA } from "@/lib/community/config";

const RULES = { pointsWin: 3, pointsDraw: 1, pointsLoss: 0, pointsParticipation: 1 };

describe("calcResultPoints", () => {
  it("telt winst, gelijk, verlies, meedoen en bonus", () => {
    expect(calcResultPoints({ wins: 3, losses: 1, draws: 0 }, RULES)).toBe(10);
    expect(calcResultPoints({ wins: 0, losses: 4, draws: 0 }, RULES)).toBe(1);
    expect(calcResultPoints({ wins: 2, losses: 1, draws: 1, bonusPoints: 2 }, RULES)).toBe(10);
  });
  it("negatieve of gebroken invoer wordt genormaliseerd", () => {
    expect(calcResultPoints({ wins: -2, losses: 1.7, draws: 0 }, RULES)).toBe(1);
    expect(calcResultPoints({ wins: NaN, losses: 0, draws: 0 }, RULES)).toBe(1);
  });
});

describe("rankStandings", () => {
  it("sorteert op punten, dan winst, dan minder events, met gedeelde plaatsen", () => {
    const rows = rankStandings([
      { userId: "a", points: 10, wins: 3, losses: 1, draws: 0, events: 2 },
      { userId: "b", points: 12, wins: 4, losses: 0, draws: 0, events: 2 },
      { userId: "c", points: 10, wins: 3, losses: 1, draws: 0, events: 2 },
      { userId: "d", points: 10, wins: 2, losses: 2, draws: 2, events: 3 },
      { userId: "e", points: 10, wins: 3, losses: 0, draws: 0, events: 1 },
    ]);
    expect(rows.map((r) => [r.userId, r.rank])).toEqual([
      ["b", 1],
      ["e", 2],
      ["a", 3],
      ["c", 3],
      ["d", 5],
    ]);
  });
});

describe("stempelkaart", () => {
  it("stampCardState rekent kaarten en rest uit", () => {
    expect(stampCardState(0, 10)).toEqual({ onCard: 0, completedCards: 0, remaining: 10 });
    expect(stampCardState(7, 10)).toEqual({ onCard: 7, completedCards: 0, remaining: 3 });
    expect(stampCardState(10, 10)).toEqual({ onCard: 0, completedCards: 1, remaining: 10 });
    expect(stampCardState(23, 10)).toEqual({ onCard: 3, completedCards: 2, remaining: 7 });
  });
  it("completesCard alleen op veelvouden", () => {
    expect(completesCard(10, 10)).toBe(true);
    expect(completesCard(20, 10)).toBe(true);
    expect(completesCard(9, 10)).toBe(false);
    expect(completesCard(0, 10)).toBe(false);
    expect(completesCard(3, 0)).toBe(true); // per=0 valt terug op 1
  });
});

describe("tekst-helpers", () => {
  it("slugify", () => {
    expect(slugify("Nieuwe set: Mega Evolutie!")).toBe("nieuwe-set-mega-evolutie");
    expect(slugify("  Café Hulst  ")).toBe("cafe-hulst");
    expect(slugify("---")).toBe("");
  });
  it("toParagraphs splitst op lege regels (ook CRLF)", () => {
    expect(toParagraphs("a\r\n\r\nb\n\n\nc\n")).toEqual(["a", "b", "c"]);
  });
});

describe("DEFAULT_BADGES", () => {
  it("unieke sleutels en geldige criteria", () => {
    const keys = DEFAULT_BADGES.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const b of DEFAULT_BADGES) {
      expect(BADGE_CRITERIA).toContain(b.criterion);
      expect(b.threshold).toBeGreaterThan(0);
    }
  });
});
