import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const notifications: Array<{ userId: string; type: string; title: string }> = [];
vi.mock("@/actions/notification", () => ({
  createNotification: vi.fn(async (userId: string, type: string, title: string) => {
    notifications.push({ userId, type, title });
  }),
}));

import { prisma } from "@/lib/prisma";
import { applyPaymentStatus } from "@/lib/shop-events/registrations";
import { onBuybackReturnPaymentStatus } from "@/lib/buyback/returns";
import { getBulkPricing } from "@/lib/buyback-pricing-db";
import { encryptIban, decryptIban, isEncryptedIban, maskStoredIban } from "@/lib/iban-crypto";
import { canMarkPaid, RETURN_FEE_EUR } from "@/lib/buyback-status";

const TAG = `bint-${Date.now().toString(36)}`;

describe("inkoop Fase 6: versleuteld IBAN, tarieven uit DB, retour via betaling", () => {
  let userId = "";
  let requestId = "";

  beforeAll(async () => {
    const u = await prisma.user.create({
      data: { email: `${TAG}@test.local`, displayName: TAG.slice(0, 16), passwordHash: "x", emailVerifiedAt: new Date(), bankTransferReference: TAG.slice(0, 20), iban: encryptIban("NL91ABNA0417164300"), accountHolderName: "Test" },
    });
    userId = u.id;
  });

  afterAll(async () => {
    await prisma.buybackRequest.deleteMany({ where: { userId } });
    await prisma.payment.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("tarieftabel wordt geseed uit BULK_PRICING en is leesbaar", async () => {
    const rows = await getBulkPricing();
    expect(rows.length).toBeGreaterThanOrEqual(10);
    expect(rows.find((r) => r.key === "COMMON")?.price).toBe(0.01);
  });

  it("IBAN staat versleuteld in de DB en is te maskeren", async () => {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { iban: true } });
    expect(isEncryptedIban(u!.iban)).toBe(true);
    expect(decryptIban(u!.iban)).toBe("NL91ABNA0417164300");
    expect(maskStoredIban(u!.iban)).toBe("NL91 **** 4300");
  });

  it("aangepaste berekening → retour betaald → RETURN_REQUESTED, idempotent", async () => {
    const req = await prisma.buybackRequest.create({
      data: { userId, type: "BULK", payoutMethod: "BANK", iban: encryptIban("NL91ABNA0417164300"), accountHolder: "Test", totalItems: 100, estimatedPayout: 40, finalPayout: 25, status: "PARTIALLY_APPROVED", decisionDeadline: new Date(Date.now() + 14 * 86_400_000) },
    });
    requestId = req.id;
    expect(canMarkPaid(req).ok).toBe(false);

    const payment = await prisma.payment.create({
      data: { provider: "FAKE", providerPaymentId: `fake_${TAG}`, purpose: "BUYBACK_RETURN", status: "OPEN", amount: RETURN_FEE_EUR, description: "retour", userId, metadata: JSON.stringify({ buybackRequestId: req.id }) },
    });
    await prisma.buybackRequest.update({ where: { id: req.id }, data: { returnPaymentId: payment.id } });

    // Mislukte betaling flipt niets.
    const failed = await applyPaymentStatus({ paymentId: payment.id, providerStatus: "failed", source: "simulate" });
    expect("ok" in failed && failed.paymentStatus).toBe("FAILED");
    expect((await prisma.buybackRequest.findUnique({ where: { id: req.id } }))!.status).toBe("PARTIALLY_APPROVED");

    // Betaald: status naar RETURN_REQUESTED, keuze RETURN, meldingen.
    const paid = await applyPaymentStatus({ paymentId: payment.id, providerStatus: "paid", source: "webhook" });
    expect("ok" in paid && paid.paymentStatus).toBe("PAID");
    const after = await prisma.buybackRequest.findUnique({ where: { id: req.id } });
    expect(after!.status).toBe("RETURN_REQUESTED");
    expect(after!.userDecision).toBe("RETURN");
    expect(notifications.some((n) => n.userId === userId && n.type === "BUYBACK_RETURN_REQUESTED")).toBe(true);

    // Tweede webhook: niets dubbel.
    const before = notifications.length;
    await applyPaymentStatus({ paymentId: payment.id, providerStatus: "paid", source: "webhook" });
    await onBuybackReturnPaymentStatus(payment.id, "PAID", new Date());
    expect(notifications.length).toBe(before);
    expect((await prisma.buybackRequest.findUnique({ where: { id: req.id } }))!.status).toBe("RETURN_REQUESTED");

    // Na retour: uitbetalen van het goedgekeurde deel mag.
    await prisma.buybackRequest.update({ where: { id: req.id }, data: { status: "RETURNED", returnedAt: new Date() } });
    expect(canMarkPaid({ ...after!, status: "RETURNED" }).ok).toBe(true);
  });
});
