import { describe, expect, it } from "vitest";
import { CRON_JOB_FLAG, CRON_JOB_NAMES, cronJobDisabledBy } from "@/lib/cron-job-flags";

describe("CRON_JOB_FLAG", () => {
  it("heeft een entry voor elke cron-job", () => {
    for (const name of CRON_JOB_NAMES) {
      expect(name in CRON_JOB_FLAG).toBe(true);
    }
    expect(Object.keys(CRON_JOB_FLAG).sort()).toEqual([...CRON_JOB_NAMES].sort());
  });

  it("altijd-jobs hebben geen flag", () => {
    expect(CRON_JOB_FLAG["sync-pokewallet"]).toBeNull();
    expect(CRON_JOB_FLAG["email-unread-messages"]).toBeNull();
    expect(CRON_JOB_FLAG["cleanup-notifications"]).toBeNull();
  });
});

describe("cronJobDisabledBy", () => {
  it("blokkeert handel-jobs bij lege env", () => {
    expect(cronJobDisabledBy("auction-finalize", {})).toBe("FEATURE_AUCTIONS");
    expect(cronJobDisabledBy("expire-claims", {})).toBe("FEATURE_CLAIMSALES");
    expect(cronJobDisabledBy("auto-confirm", {})).toBe("FEATURE_WALLET");
  });

  it("laat altijd-jobs door", () => {
    expect(cronJobDisabledBy("sync-pokewallet", {})).toBeNull();
  });

  it("laat door zodra de flag (en z'n vereisten) aan staan", () => {
    expect(
      cronJobDisabledBy("auction-finalize", { FEATURE_AUCTIONS: "true", FEATURE_WALLET: "true" }),
    ).toBeNull();
    // Alleen de eigen flag aan, wallet uit → nog steeds geblokkeerd
    expect(cronJobDisabledBy("auction-finalize", { FEATURE_AUCTIONS: "true" })).toBe(
      "FEATURE_AUCTIONS",
    );
  });
});
