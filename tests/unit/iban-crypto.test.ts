import { beforeEach, describe, expect, it } from "vitest";
import { _resetIbanKeyCache, decryptIban, encryptIban, isEncryptedIban, maskStoredIban } from "@/lib/iban-crypto";
import { ADMIN_TRANSITIONS, awaitsSellerDecision, canMarkPaid, decisionDeadlineFrom, DECISION_DAYS } from "@/lib/buyback-status";

const KEY = Buffer.alloc(32, 7).toString("base64");
const env = { IBAN_ENCRYPTION_KEY: KEY };

describe("iban-crypto", () => {
  beforeEach(() => _resetIbanKeyCache());

  it("rondreis en normalisatie", () => {
    const enc = encryptIban("nl91 abna 0417 1643 00", env);
    expect(isEncryptedIban(enc)).toBe(true);
    expect(enc).not.toContain("ABNA");
    expect(decryptIban(enc, env)).toBe("NL91ABNA0417164300");
  });

  it("twee keer versleutelen geeft verschillende ciphertext (random iv) maar zelfde plaintext", () => {
    const a = encryptIban("NL91ABNA0417164300", env);
    const b = encryptIban("NL91ABNA0417164300", env);
    expect(a).not.toBe(b);
    expect(decryptIban(a, env)).toBe(decryptIban(b, env));
  });

  it("platte legacy-waarde komt ongewijzigd terug; null blijft null", () => {
    expect(decryptIban("NL91ABNA0417164300", env)).toBe("NL91ABNA0417164300");
    expect(decryptIban(null, env)).toBeNull();
    expect(isEncryptedIban("NL91ABNA0417164300")).toBe(false);
  });

  it("verkeerde sleutel faalt op de auth-tag", () => {
    const enc = encryptIban("NL91ABNA0417164300", env);
    _resetIbanKeyCache();
    expect(() => decryptIban(enc, { IBAN_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64") })).toThrow();
  });

  it("maskStoredIban toont alleen begin en eind", () => {
    const enc = encryptIban("NL91ABNA0417164300", env);
    expect(maskStoredIban(enc, env)).toBe("NL91 **** 4300");
  });

  it("ongeldige sleutellengte wordt geweigerd", () => {
    expect(() => encryptIban("NL91ABNA0417164300", { IBAN_ENCRYPTION_KEY: "kort" })).toThrow();
  });
});

describe("buyback-status", () => {
  it("admin-overgangen", () => {
    expect(ADMIN_TRANSITIONS.PENDING).toContain("RECEIVED");
    expect(ADMIN_TRANSITIONS.INSPECTING).toEqual(["APPROVED", "PARTIALLY_APPROVED", "REJECTED"]);
    expect(ADMIN_TRANSITIONS.RETURN_REQUESTED).toEqual(["RETURNED"]);
    expect(ADMIN_TRANSITIONS.REJECTED).toBeUndefined();
  });

  it("verkoper moet kiezen bij aangepaste berekening en afkeur", () => {
    expect(awaitsSellerDecision({ status: "PARTIALLY_APPROVED", userDecision: null })).toBe(true);
    expect(awaitsSellerDecision({ status: "REJECTED", userDecision: null })).toBe(true);
    expect(awaitsSellerDecision({ status: "PARTIALLY_APPROVED", userDecision: "ACCEPT" })).toBe(false);
    expect(awaitsSellerDecision({ status: "APPROVED", userDecision: null })).toBe(false);
  });

  it("uitbetalen: akkoord of verlopen termijn", () => {
    const now = new Date("2026-10-16T12:00:00Z");
    const base = { status: "PARTIALLY_APPROVED", userDecision: null, finalPayout: 12, estimatedPayout: 20 };
    expect(canMarkPaid({ ...base, decisionDeadline: new Date("2026-10-30T00:00:00Z") }, now).ok).toBe(false);
    expect(canMarkPaid({ ...base, decisionDeadline: new Date("2026-10-15T00:00:00Z") }, now).ok).toBe(true);
    expect(canMarkPaid({ ...base, userDecision: "ACCEPT", decisionDeadline: null }, now).ok).toBe(true);
    expect(canMarkPaid({ ...base, userDecision: "RETURN", decisionDeadline: null }, now).ok).toBe(false);
    expect(canMarkPaid({ ...base, status: "APPROVED", decisionDeadline: null }, now).ok).toBe(true);
    expect(canMarkPaid({ ...base, status: "RETURNED", finalPayout: 0, decisionDeadline: null }, now).ok).toBe(false);
    expect(canMarkPaid({ ...base, status: "RETURNED", finalPayout: 5, decisionDeadline: null }, now).ok).toBe(true);
  });

  it("beslistermijn", () => {
    const d = decisionDeadlineFrom(new Date("2026-10-01T00:00:00Z"));
    expect((d.getTime() - new Date("2026-10-01T00:00:00Z").getTime()) / 86_400_000).toBe(DECISION_DAYS);
  });
});
