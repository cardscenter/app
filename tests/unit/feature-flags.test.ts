import { describe, expect, it } from "vitest";
import {
  FEATURE_FLAG_KEYS,
  FEATURE_FLAGS,
  anyTradeFeatureVisible,
  emptyFeatureSnapshot,
  getFeatureSnapshot,
  isFeatureEnabled,
  isFeatureVisibleFor,
} from "@/lib/feature-flags";

describe("isFeatureEnabled", () => {
  it("staat standaard uit (lege env)", () => {
    for (const flag of FEATURE_FLAG_KEYS) {
      expect(isFeatureEnabled(flag, {})).toBe(false);
    }
  });

  it("accepteert true / 1 / on (case-insensitive, getrimd)", () => {
    for (const v of ["true", "TRUE", " 1 ", "on", "On"]) {
      expect(isFeatureEnabled("FEATURE_WALLET", { FEATURE_WALLET: v })).toBe(true);
    }
  });

  it("alles anders is uit", () => {
    for (const v of ["false", "0", "off", "yes", "", "ja", undefined]) {
      expect(isFeatureEnabled("FEATURE_WALLET", { FEATURE_WALLET: v })).toBe(false);
    }
  });

  it("handel-flags vereisen FEATURE_WALLET", () => {
    expect(isFeatureEnabled("FEATURE_AUCTIONS", { FEATURE_AUCTIONS: "true" })).toBe(false);
    expect(isFeatureEnabled("FEATURE_CLAIMSALES", { FEATURE_CLAIMSALES: "true" })).toBe(false);
    expect(isFeatureEnabled("FEATURE_MARKETPLACE", { FEATURE_MARKETPLACE: "true" })).toBe(false);
    expect(
      isFeatureEnabled("FEATURE_AUCTIONS", { FEATURE_AUCTIONS: "true", FEATURE_WALLET: "true" }),
    ).toBe(true);
  });

  it("wallet aan zet de handel-flags niet vanzelf aan", () => {
    expect(isFeatureEnabled("FEATURE_AUCTIONS", { FEATURE_WALLET: "true" })).toBe(false);
  });

  it("community-events staat los van wallet", () => {
    expect(isFeatureEnabled("FEATURE_COMMUNITY_EVENTS", { FEATURE_COMMUNITY_EVENTS: "true" })).toBe(
      true,
    );
  });
});

describe("isFeatureVisibleFor", () => {
  it("admin ziet alles, ook bij flag uit", () => {
    expect(isFeatureVisibleFor("FEATURE_AUCTIONS", "ADMIN", {})).toBe(true);
    expect(isFeatureVisibleFor("FEATURE_WALLET", "ADMIN", {})).toBe(true);
  });

  it("een flag zonder admin-bypass blijft ook voor admins uit", () => {
    expect(isFeatureVisibleFor("FEATURE_XP", "ADMIN", {})).toBe(false);
    expect(isFeatureVisibleFor("FEATURE_XP", "ADMIN", { FEATURE_XP: "true" })).toBe(true);
    expect(isFeatureVisibleFor("FEATURE_XP", "FREE", { FEATURE_XP: "true" })).toBe(true);
  });

  it("gewone gebruikers en anonieme bezoekers niet", () => {
    for (const type of ["FREE", "PRO", "UNLIMITED", "ENTERPRISE", null, undefined]) {
      expect(isFeatureVisibleFor("FEATURE_AUCTIONS", type, {})).toBe(false);
    }
  });

  it("iedereen ziet een flag die aan staat", () => {
    const env = { FEATURE_WALLET: "true" };
    expect(isFeatureVisibleFor("FEATURE_WALLET", null, env)).toBe(true);
    expect(isFeatureVisibleFor("FEATURE_WALLET", "FREE", env)).toBe(true);
  });
});

describe("snapshots", () => {
  it("getFeatureSnapshot dekt alle flags per bezoeker", () => {
    const snap = getFeatureSnapshot("FREE", { FEATURE_WALLET: "true" });
    expect(Object.keys(snap).sort()).toEqual([...FEATURE_FLAG_KEYS].sort());
    expect(snap.FEATURE_WALLET).toBe(true);
    expect(snap.FEATURE_AUCTIONS).toBe(false);
  });

  it("admin-snapshot is overal true, behalve flags zonder admin-bypass", () => {
    const snap = getFeatureSnapshot("ADMIN", {});
    for (const flag of FEATURE_FLAG_KEYS) {
      expect(snap[flag]).toBe(FEATURE_FLAGS[flag].adminBypass !== false);
    }
    expect(snap.FEATURE_XP).toBe(false);
  });

  it("emptyFeatureSnapshot is overal false", () => {
    expect(Object.values(emptyFeatureSnapshot()).some(Boolean)).toBe(false);
  });

  it("anyTradeFeatureVisible", () => {
    expect(anyTradeFeatureVisible("FREE", {})).toBe(false);
    expect(anyTradeFeatureVisible("ADMIN", {})).toBe(true);
    expect(
      anyTradeFeatureVisible("FREE", { FEATURE_WALLET: "true", FEATURE_MARKETPLACE: "true" }),
    ).toBe(true);
  });
});
