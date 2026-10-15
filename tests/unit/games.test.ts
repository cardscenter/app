import { describe, expect, it } from "vitest";
import { parseFavoriteGames, parsePlayerIds, validatePlayerId } from "@/lib/games";
import { effectiveRole, isStaff } from "@/lib/roles";
import { generateMagicToken, hashMagicToken, looksLikeMagicToken, magicTokenHashesMatch } from "@/lib/magic-link";

describe("favoriete spellen + spelers-ID's", () => {
  it("parseFavoriteGames houdt alleen bekende, unieke keys", () => {
    expect(parseFavoriteGames('["pokemon","lorcana","pokemon","chess"]')).toEqual(["pokemon", "lorcana"]);
    expect(parseFavoriteGames("kapot")).toEqual([]);
    expect(parseFavoriteGames(null)).toEqual([]);
  });

  it("parsePlayerIds houdt alleen bekende keys met nette waarden", () => {
    expect(parsePlayerIds('{"pokemon":" 1234567 ","yugioh":"","chess":"x","mtg":"<script>"}')).toEqual({ pokemon: "1234567" });
    expect(parsePlayerIds("[1,2]")).toEqual({});
  });

  it("validatePlayerId", () => {
    expect(validatePlayerId("  ")).toEqual({ ok: true, value: "" });
    expect(validatePlayerId("ABC-123")).toEqual({ ok: true, value: "ABC-123" });
    expect(validatePlayerId("a".repeat(41)).ok).toBe(false);
    expect(validatePlayerId("<b>").ok).toBe(false);
  });
});

describe("rollen", () => {
  it("accountType ADMIN wint altijd", () => {
    expect(effectiveRole({ role: "PLAYER", accountType: "ADMIN" })).toBe("ADMIN");
    expect(effectiveRole({ role: "STAFF", accountType: "FREE" })).toBe("STAFF");
    expect(effectiveRole({ role: "onzin", accountType: "PRO" })).toBe("PLAYER");
    expect(isStaff({ role: "STAFF", accountType: "FREE" })).toBe(true);
    expect(isStaff({ role: "PLAYER", accountType: "FREE" })).toBe(false);
  });
});

describe("magic-link tokens", () => {
  it("genereert 43-teken base64url tokens en hasht ze stabiel", () => {
    const t = generateMagicToken();
    expect(looksLikeMagicToken(t)).toBe(true);
    expect(looksLikeMagicToken("kort")).toBe(false);
    expect(hashMagicToken(t)).toBe(hashMagicToken(t));
    expect(hashMagicToken(t)).not.toBe(hashMagicToken(generateMagicToken()));
    expect(magicTokenHashesMatch(hashMagicToken(t), hashMagicToken(t))).toBe(true);
    expect(magicTokenHashesMatch(hashMagicToken(t), "x")).toBe(false);
  });
});
