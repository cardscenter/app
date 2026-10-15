import { describe, expect, it } from "vitest";
import {
  POKEMON_DIVISIONS_2027,
  ageOn,
  divisionFor,
  isMinor,
  isPlausibleDateOfBirth,
  needsSupervision,
  parseDateOfBirth,
} from "@/lib/age";

const AT = new Date(Date.UTC(2027, 5, 15)); // 15 juni 2027

describe("ageOn", () => {
  it("telt volle jaren, ook rond de verjaardag", () => {
    expect(ageOn(new Date(Date.UTC(2011, 5, 15)), AT)).toBe(16); // jarig vandaag
    expect(ageOn(new Date(Date.UTC(2011, 5, 16)), AT)).toBe(15); // morgen jarig
    expect(ageOn(new Date(Date.UTC(2011, 5, 14)), AT)).toBe(16);
    expect(ageOn(new Date(Date.UTC(2000, 0, 1)), AT)).toBe(27);
  });
});

describe("leeftijdsregels", () => {
  it("onder 16 = ouder-toestemming, onder 12 = begeleiding", () => {
    expect(isMinor(new Date(Date.UTC(2012, 0, 1)), AT)).toBe(true);
    expect(isMinor(new Date(Date.UTC(2011, 0, 1)), AT)).toBe(false);
    expect(needsSupervision(new Date(Date.UTC(2016, 0, 1)), AT)).toBe(true);
    expect(needsSupervision(new Date(Date.UTC(2015, 0, 1)), AT)).toBe(false);
  });
});

describe("divisionFor", () => {
  it("deelt in op geboortejaar", () => {
    expect(divisionFor(new Date(Date.UTC(2016, 3, 1)), POKEMON_DIVISIONS_2027)?.key).toBe("junior");
    expect(divisionFor(new Date(Date.UTC(2015, 0, 1)), POKEMON_DIVISIONS_2027)?.key).toBe("junior");
    expect(divisionFor(new Date(Date.UTC(2014, 11, 31)), POKEMON_DIVISIONS_2027)?.key).toBe("senior");
    expect(divisionFor(new Date(Date.UTC(2011, 0, 1)), POKEMON_DIVISIONS_2027)?.key).toBe("senior");
    expect(divisionFor(new Date(Date.UTC(2010, 0, 1)), POKEMON_DIVISIONS_2027)?.key).toBe("masters");
    expect(divisionFor(new Date(Date.UTC(1990, 0, 1)), POKEMON_DIVISIONS_2027)?.key).toBe("masters");
  });
});

describe("parseDateOfBirth", () => {
  it("accepteert YYYY-MM-DD en weigert onzin", () => {
    expect(parseDateOfBirth("2010-02-28")?.toISOString()).toBe("2010-02-28T00:00:00.000Z");
    expect(parseDateOfBirth("2010-02-31")).toBeNull();
    expect(parseDateOfBirth("28-02-2010")).toBeNull();
    expect(parseDateOfBirth("")).toBeNull();
    expect(parseDateOfBirth(null)).toBeNull();
  });

  it("plausibiliteit: niet in de toekomst, niet ouder dan 120", () => {
    expect(isPlausibleDateOfBirth(new Date(Date.UTC(2028, 0, 1)), AT)).toBe(false);
    expect(isPlausibleDateOfBirth(new Date(Date.UTC(1900, 0, 1)), AT)).toBe(false);
    expect(isPlausibleDateOfBirth(new Date(Date.UTC(1990, 0, 1)), AT)).toBe(true);
  });
});
