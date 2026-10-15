import { describe, expect, it } from "vitest";
import { featureForPath, stripLocale } from "@/lib/feature-routes";

describe("stripLocale", () => {
  it("haalt /nl en /en van het pad", () => {
    expect(stripLocale("/nl/veilingen")).toBe("/veilingen");
    expect(stripLocale("/en/dashboard/saldo")).toBe("/dashboard/saldo");
    expect(stripLocale("/nl")).toBe("/");
    expect(stripLocale("/")).toBe("/");
  });

  it("raakt paden die toevallig met nl beginnen niet aan", () => {
    expect(stripLocale("/nlx/foo")).toBe("/nlx/foo");
  });
});

describe("featureForPath", () => {
  it.each([
    ["/nl/veilingen", "FEATURE_AUCTIONS"],
    ["/nl/veilingen/abc123", "FEATURE_AUCTIONS"],
    ["/en/veilingen/nieuw", "FEATURE_AUCTIONS"],
    ["/nl/dashboard/biedingen", "FEATURE_AUCTIONS"],
    ["/nl/dashboard/volglijst", "FEATURE_AUCTIONS"],
    ["/nl/claimsales", "FEATURE_CLAIMSALES"],
    ["/nl/winkelwagen", "FEATURE_CLAIMSALES"],
    ["/nl/dashboard/claimsales/x/claims", "FEATURE_CLAIMSALES"],
    ["/nl/marktplaats/bulk-upload", "FEATURE_MARKETPLACE"],
    ["/nl/dashboard/marktplaats", "FEATURE_MARKETPLACE"],
    ["/en/dashboard/saldo", "FEATURE_WALLET"],
    ["/nl/dashboard/saldo/openstaande-kosten", "FEATURE_WALLET"],
    ["/nl/dashboard/geschillen/abc", "FEATURE_WALLET"],
    ["/nl/dashboard/geschillen-v2/abc", "FEATURE_WALLET"],
    ["/nl/winkel/mijn-slug", "FEATURE_WALLET"],
    ["/nl/customization/packs", "FEATURE_WALLET"],
    ["/veilingen", "FEATURE_AUCTIONS"],
    ["/nl/dashboard/level", "FEATURE_XP"],
    ["/nl/dashboard/reviews", "FEATURE_WALLET"],
  ] as const)("%s → %s", (path, flag) => {
    expect(featureForPath(path)).toBe(flag);
  });

  it.each([
    "/",
    "/nl",
    "/nl/verkopen",
    "/nl/verkopen/bulk",
    "/nl/dashboard/inkoop",
    "/nl/dashboard",
    "/nl/dashboard/profiel",
    "/nl/dashboard/instellingen",
    "/nl/evenementen",
    "/nl/kaarten",
    "/nl/berichten/abc",
    "/nl/verkoper/abc",
    "/nl/veilingenx",
    "/nl/claimsalesfoo",
    "/nl/winkelwagentje",
  ])("%s is vrij", (path) => {
    expect(featureForPath(path)).toBeNull();
  });
});
