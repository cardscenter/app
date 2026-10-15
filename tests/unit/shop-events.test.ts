import { describe, expect, it } from "vitest";
import {
  canCancelWithRefund,
  computeAvailability,
  divisionKeyFor,
  effectiveCapacity,
  generateTicketCode,
  isWithinCheckInWindow,
  mapProviderStatus,
  normalizeTicketCode,
  parseAgeDivisions,
  registrationWindow,
  TICKET_CODE_REGEX,
  toMollieAmount,
  ageAllowed,
} from "@/lib/shop-events/config";
import { POKEMON_DIVISIONS_2027 } from "@/lib/age";
import { shopWallClockToUtc, utcToShopWallClock, monthKey, dayKey } from "@/lib/shop-events/format";

const H = 3600_000;

describe("capaciteit", () => {
  it("laagste van event-capaciteit en pand-maximum wint", () => {
    expect(effectiveCapacity(28, 60)).toBe(28);
    expect(effectiveCapacity(80, 60)).toBe(60);
    expect(effectiveCapacity(null, 60)).toBe(60);
    expect(effectiveCapacity(null, null)).toBeNull();
    expect(effectiveCapacity(0, null)).toBeNull();
  });

  it("computeAvailability: vol, plekken over, onbeperkt", () => {
    expect(computeAvailability({ eventCapacity: 10, maxOccupancy: 60, occupied: 10, waitlistCount: 2 })).toMatchObject({ full: true, spotsLeft: 0, waitlistCount: 2 });
    expect(computeAvailability({ eventCapacity: 10, maxOccupancy: 60, occupied: 7, waitlistCount: 0 })).toMatchObject({ full: false, spotsLeft: 3 });
    expect(computeAvailability({ eventCapacity: null, maxOccupancy: null, occupied: 999, waitlistCount: 0 })).toMatchObject({ full: false, spotsLeft: null });
  });
});

describe("inschrijfvenster", () => {
  const start = new Date("2027-06-12T17:00:00Z");
  const base = { status: "PUBLISHED", startsAt: start, registrationOpensAt: null, registrationDeadline: null };

  it("open tot de start als er geen deadline is", () => {
    expect(registrationWindow(base, new Date(start.getTime() - H))).toBe("open");
    expect(registrationWindow(base, start)).toBe("started");
  });
  it("respecteert opens/deadline", () => {
    const ev = { ...base, registrationOpensAt: new Date(start.getTime() - 48 * H), registrationDeadline: new Date(start.getTime() - 2 * H) };
    expect(registrationWindow(ev, new Date(start.getTime() - 72 * H))).toBe("not-yet");
    expect(registrationWindow(ev, new Date(start.getTime() - 24 * H))).toBe("open");
    expect(registrationWindow(ev, new Date(start.getTime() - H))).toBe("closed");
  });
  it("concept/geannuleerd = niet beschikbaar", () => {
    expect(registrationWindow({ ...base, status: "DRAFT" }, new Date(0))).toBe("unavailable");
    expect(registrationWindow({ ...base, status: "CANCELLED" }, new Date(0))).toBe("unavailable");
  });
});

describe("annuleren en check-in", () => {
  const start = new Date("2027-06-12T17:00:00Z");
  const end = new Date("2027-06-12T21:00:00Z");
  it("terugbetaling tot cancellationHours vóór de start", () => {
    const ev = { startsAt: start, cancellationHours: 24 };
    expect(canCancelWithRefund(ev, new Date(start.getTime() - 25 * H))).toBe(true);
    expect(canCancelWithRefund(ev, new Date(start.getTime() - 23 * H))).toBe(false);
  });
  it("check-in-venster 3u voor tot 3u na", () => {
    const ev = { startsAt: start, endsAt: end };
    expect(isWithinCheckInWindow(ev, new Date(start.getTime() - 4 * H))).toBe(false);
    expect(isWithinCheckInWindow(ev, new Date(start.getTime() - 2 * H))).toBe(true);
    expect(isWithinCheckInWindow(ev, new Date(end.getTime() + 2 * H))).toBe(true);
    expect(isWithinCheckInWindow(ev, new Date(end.getTime() + 4 * H))).toBe(false);
  });
  it("leeftijdsgrenzen", () => {
    expect(ageAllowed(10, { minAge: 12, maxAge: null })).toBe(false);
    expect(ageAllowed(12, { minAge: 12, maxAge: null })).toBe(true);
    expect(ageAllowed(16, { minAge: null, maxAge: 15 })).toBe(false);
    expect(ageAllowed(30, { minAge: null, maxAge: null })).toBe(true);
  });
});

describe("divisies", () => {
  it("parseAgeDivisions is tolerant", () => {
    expect(parseAgeDivisions(null)).toEqual([]);
    expect(parseAgeDivisions("not json")).toEqual([]);
    expect(parseAgeDivisions(JSON.stringify([{ key: "x" }, { key: "junior", label: "Junior", minBirthYear: 2015 }]))).toEqual([
      { key: "junior", label: "Junior", minBirthYear: 2015, maxBirthYear: undefined },
    ]);
  });
  it("divisionKeyFor met Pokémon-defaults", () => {
    expect(divisionKeyFor(new Date(Date.UTC(2016, 0, 1)), POKEMON_DIVISIONS_2027)).toBe("junior");
    expect(divisionKeyFor(new Date(Date.UTC(2012, 5, 1)), POKEMON_DIVISIONS_2027)).toBe("senior");
    expect(divisionKeyFor(new Date(Date.UTC(1990, 5, 1)), POKEMON_DIVISIONS_2027)).toBe("masters");
    expect(divisionKeyFor(new Date(Date.UTC(1990, 5, 1)), [])).toBeNull();
    expect(divisionKeyFor(null, POKEMON_DIVISIONS_2027)).toBeNull();
  });
});

describe("ticketcodes", () => {
  it("formaat CC-XXXXXX zonder 0/O/1/I", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateTicketCode();
      expect(code).toMatch(TICKET_CODE_REGEX);
      expect(code).not.toMatch(/[01OI]/);
    }
  });
  it("normalizeTicketCode accepteert varianten", () => {
    expect(normalizeTicketCode(" cc-ab23cd ")).toBe("CC-AB23CD");
    expect(normalizeTicketCode("AB23CD")).toBe("CC-AB23CD");
    expect(normalizeTicketCode("CC|AB23CD|deadbeef")).toBe("CC-AB23CD");
    expect(normalizeTicketCode("CC-AB01CD")).toBeNull();
    expect(normalizeTicketCode("")).toBeNull();
  });
});

describe("Mollie-mapping", () => {
  it("bedragen met twee decimalen", () => {
    expect(toMollieAmount(5)).toBe("5.00");
    expect(toMollieAmount(12.5)).toBe("12.50");
    expect(toMollieAmount(0.1 + 0.2)).toBe("0.30");
  });
  it("statussen", () => {
    expect(mapProviderStatus("paid")).toBe("PAID");
    expect(mapProviderStatus("open")).toBe("OPEN");
    expect(mapProviderStatus("pending")).toBe("PENDING");
    expect(mapProviderStatus("authorized")).toBe("PENDING");
    expect(mapProviderStatus("failed")).toBe("FAILED");
    expect(mapProviderStatus("canceled")).toBe("CANCELED");
    expect(mapProviderStatus("expired")).toBe("EXPIRED");
    expect(mapProviderStatus("whatever")).toBe("OPEN");
  });
});

describe("winkel-tijd (Europe/Amsterdam)", () => {
  it("wandklok → UTC, zomer- en wintertijd", () => {
    expect(shopWallClockToUtc("2027-06-12", "19:00")?.toISOString()).toBe("2027-06-12T17:00:00.000Z");
    expect(shopWallClockToUtc("2027-01-12", "19:00")?.toISOString()).toBe("2027-01-12T18:00:00.000Z");
    expect(shopWallClockToUtc("2027-13-01", "19:00")).toBeNull();
    expect(shopWallClockToUtc("2027-01-12", "7pm")).toBeNull();
  });
  it("UTC → wandklok round-trip", () => {
    const d = shopWallClockToUtc("2027-03-28", "02:30")!; // net na de DST-wissel
    const back = utcToShopWallClock(d);
    expect(shopWallClockToUtc(back.date, back.time)?.getTime()).toBe(d.getTime());
    expect(utcToShopWallClock(new Date("2027-06-12T17:00:00Z"))).toEqual({ date: "2027-06-12", time: "19:00" });
  });
  it("maand- en dagsleutels in winkel-tijd", () => {
    expect(monthKey(new Date("2027-05-31T22:30:00Z"))).toBe("2027-06");
    expect(dayKey(new Date("2027-05-31T22:30:00Z"))).toBe("2027-06-01");
  });
});
