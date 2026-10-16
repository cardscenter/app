import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const notifications: Array<{ userId: string; type: string; title: string }> = [];
vi.mock("@/actions/notification", () => ({
  createNotification: vi.fn(async (userId: string, type: string, title: string) => {
    notifications.push({ userId, type, title });
  }),
}));

import { prisma } from "@/lib/prisma";
import { checkInByCode } from "@/lib/shop-events/registrations";
import { generateTicketCode } from "@/lib/shop-events/config";
import { newQrSecret } from "@/lib/shop-events/tickets";
import { ensureLeagueDefaults, getStandings, upsertResult, getUserLeagueSummary, awardBadgesFor } from "@/lib/community/league";
import { addStamp, getLoyaltySummary, redeemPoints } from "@/lib/community/loyalty";
import { getHubSettings } from "@/lib/app-config";

const TAG = `cint-${Date.now().toString(36)}`;
const DAY = 24 * 3600_000;

async function makeUser(name: string, extra: Record<string, unknown> = {}) {
  return prisma.user.create({
    data: {
      email: `${TAG}-${name}@test.local`,
      displayName: `${TAG}-${name}`.slice(0, 16),
      passwordHash: "x",
      emailVerifiedAt: new Date(),
      dateOfBirth: new Date(Date.UTC(1990, 0, 1)),
      bankTransferReference: `${TAG}${name}`.slice(0, 20),
      ...extra,
    },
  });
}

describe("community: check-in → stempel + punten, uitslagen → ranglijst, badges, inwisselen", () => {
  let staffId = "";
  let alice = "";
  let bob = "";
  let hidden = "";
  let typeId = "";
  let eventId = "";
  let seasonId = "";
  let ticketA = "";
  let ticketB = "";

  beforeAll(async () => {
    await ensureLeagueDefaults();
    staffId = (await makeUser("staff", { role: "STAFF" })).id;
    alice = (await makeUser("alice")).id;
    bob = (await makeUser("bob")).id;
    hidden = (await makeUser("hidden", { showOnLeaderboards: false })).id;
    const type = await prisma.eventType.create({ data: { key: `${TAG}-type`, name: "League-test", color: "blue", countsForLeague: true, countsForStampCard: true } });
    typeId = type.id;
    const now = Date.now();
    const ev = await prisma.shopEvent.create({
      data: { typeId, title: `${TAG} avond`, startsAt: new Date(now - 3600_000), endsAt: new Date(now + 3600_000), status: "PUBLISHED", price: 0, countsForLeague: true, countsForStampCard: true, createdById: staffId },
    });
    eventId = ev.id;
    const mk = async (userId: string) => {
      const code = generateTicketCode();
      await prisma.eventRegistration.create({ data: { eventId, userId, status: "CONFIRMED", ticketCode: code, qrSecret: newQrSecret(), amount: 0, confirmedAt: new Date() } });
      return code;
    };
    ticketA = await mk(alice);
    ticketB = await mk(bob);
    const season = await prisma.leagueSeason.create({ data: { name: `${TAG} seizoen`, startsAt: new Date(now - 30 * DAY), endsAt: new Date(now + 30 * DAY), status: "ACTIVE" } });
    seasonId = season.id;
  });

  afterAll(async () => {
    await prisma.loyaltyEntry.deleteMany({ where: { user: { email: { startsWith: TAG } } } });
    await prisma.userLeagueBadge.deleteMany({ where: { user: { email: { startsWith: TAG } } } });
    await prisma.leagueResult.deleteMany({ where: { seasonId } });
    await prisma.leagueSeason.deleteMany({ where: { id: seasonId } });
    await prisma.eventRegistration.deleteMany({ where: { eventId } });
    await prisma.shopEvent.deleteMany({ where: { id: eventId } });
    await prisma.eventType.deleteMany({ where: { id: typeId } });
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  });

  it("check-in geeft één stempel en punten, ook bij dubbele check-in", async () => {
    const settings = await getHubSettings();
    const r1 = await checkInByCode({ ticketCode: ticketA, staffUserId: staffId });
    expect("ok" in r1 && !r1.already).toBe(true);
    const r2 = await checkInByCode({ ticketCode: ticketA, staffUserId: staffId });
    expect("ok" in r2 && r2.already).toBe(true);
    const s = await getLoyaltySummary(alice);
    expect(s.stamps.total).toBe(1);
    expect(s.points.balance).toBe(settings.pointsPerCheckIn);
  });

  it("volle kaart geeft bonuspunten en een melding", async () => {
    const settings = await getHubSettings();
    for (let i = 0; i < settings.stampsPerCard - 1; i++) {
      await addStamp({ userId: alice, reason: `test ${i}`, source: "STAFF", staffId });
    }
    const s = await getLoyaltySummary(alice);
    expect(s.stamps.completedCards).toBe(1);
    expect(s.stamps.onCard).toBe(0);
    expect(s.points.balance).toBe(settings.pointsPerCheckIn + settings.pointsPerFullCard);
    expect(notifications.some((n) => n.userId === alice && n.type === "LOYALTY_FULL_CARD")).toBe(true);
    // Stadspoort-badge (10 stempels totaal) is toegekend.
    const summary = await getUserLeagueSummary(alice);
    expect(summary.badges.some((b) => b.key === "stadspoort")).toBe(true);
  });

  it("inwisselen nooit onder nul", async () => {
    const before = (await getLoyaltySummary(alice)).points.balance;
    const tooMuch = await redeemPoints({ userId: alice, points: before + 1, reason: "x", staffId });
    expect("error" in tooMuch).toBe(true);
    const ok = await redeemPoints({ userId: alice, points: 5, reason: "drankje", staffId });
    expect("ok" in ok && ok.balance).toBe(before - 5);
  });

  it("uitslagen → punten volgens seizoensregels, ranglijst met gedeelde plaatsen, privacy", async () => {
    await checkInByCode({ ticketCode: ticketB, staffUserId: staffId });
    expect(await upsertResult({ seasonId, eventId, userId: alice, wins: 3, losses: 0, draws: 0, enteredById: staffId })).toEqual({ ok: true, points: 10 });
    expect(await upsertResult({ seasonId, eventId, userId: bob, wins: 2, losses: 1, draws: 0, enteredById: staffId })).toEqual({ ok: true, points: 7 });
    expect(await upsertResult({ seasonId, eventId, userId: hidden, wins: 3, losses: 0, draws: 0, enteredById: staffId })).toEqual({ ok: true, points: 10 });
    // Bijwerken overschrijft (unique seizoen+event+speler).
    expect(await upsertResult({ seasonId, eventId, userId: bob, wins: 1, losses: 2, draws: 0, bonusPoints: 1, enteredById: staffId })).toEqual({ ok: true, points: 5 });
    expect(await prisma.leagueResult.count({ where: { seasonId } })).toBe(3);

    const publicRows = await getStandings(seasonId, null);
    expect(publicRows.map((r) => r.userId)).toEqual([alice, bob]);
    expect(publicRows[0].rank).toBe(1);
    expect(publicRows[1].rank).toBe(3); // hidden deelt plaats 1, bob is 3e

    const ownView = await getStandings(seasonId, hidden);
    expect(ownView.find((r) => r.userId === hidden)?.isViewer).toBe(true);
    expect(ownView.find((r) => r.userId === hidden)?.rank).toBe(1);

    // Eerste league-avond → Bagijnepoort.
    await awardBadgesFor(bob, seasonId);
    const bobSummary = await getUserLeagueSummary(bob);
    expect(bobSummary.badges.some((b) => b.key === "bagijnepoort")).toBe(true);
    expect(bobSummary.rank).toBe(3);
    expect(notifications.some((n) => n.userId === bob && n.type === "LEAGUE_BADGE")).toBe(true);
  });

  it("uitslag in een afgesloten seizoen wordt geweigerd", async () => {
    await prisma.leagueSeason.update({ where: { id: seasonId }, data: { status: "CLOSED" } });
    const r = await upsertResult({ seasonId, eventId: null, userId: alice, wins: 1, losses: 0, draws: 0, enteredById: staffId });
    expect("error" in r).toBe(true);
  });
});
