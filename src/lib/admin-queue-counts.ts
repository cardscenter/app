import { prisma } from "@/lib/prisma";

/**
 * Openstaand werk per admin-wachtrij — één bron voor de sidebar-badges
 * (AdminNav) én de KPI-tegels op /dashboard/admin, zodat beide altijd
 * hetzelfde getal tonen.
 */
export type AdminQueueCounts = {
  disputes: number;
  activeDisputes: number;
  shippingIssues: number;
  verifications: number;
  withdrawals: number;
  buybacks: number;
  reports: number;
  sellerWarnings: number;
  enterpriseRequests: number;
  eventApprovals: number;
  eventReports: number;
  bidDefaulters: number;
};

export async function getAdminQueueCounts(): Promise<AdminQueueCounts> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [
    disputes,
    activeDisputes,
    shippingIssues,
    verifications,
    withdrawals,
    buybacks,
    reports,
    sellerWarnings,
    enterpriseRequests,
    eventApprovals,
    eventReports,
    bidDefaulters,
  ] = await Promise.all([
    prisma.disputeV2.count({ where: { status: "ESCALATED" } }),
    prisma.disputeV2.count({ where: { status: { in: ["OPEN", "SELLER_RESPONDED", "MEDIATION"] } } }),
    prisma.shippingIssue.count({ where: { status: { in: ["OPEN", "INVESTIGATING"] } } }),
    prisma.verificationRequest.count({ where: { status: "PENDING" } }),
    prisma.withdrawalRequest.count({ where: { status: "PENDING" } }),
    prisma.buybackRequest.count({ where: { status: { in: ["PENDING", "RECEIVED", "INSPECTING"] } } }),
    prisma.userReport.count({ where: { status: { in: ["OPEN", "REVIEWING"] } } }),
    // Auto-geannuleerde PAID-bundles (verkoper verzond niet) — laatste 30 dagen.
    prisma.shippingBundle.count({ where: { autoExpiredAt: { gte: thirtyDaysAgo } } }),
    prisma.enterpriseRequest.count({ where: { status: "PENDING" } }),
    prisma.event.count({ where: { status: "PENDING" } }),
    prisma.eventReport.count({ where: { status: { in: ["OPEN", "REVIEWING"] } } }),
    // Wanbetalers die actief geschorst zijn (2+ strikes).
    prisma.user.count({
      where: {
        paymentFailureCount: { gte: 2 },
        OR: [{ suspensionType: "PERMANENT" }, { suspendedUntil: { gt: new Date() } }],
      },
    }),
  ]);

  return {
    disputes,
    activeDisputes,
    shippingIssues,
    verifications,
    withdrawals,
    buybacks,
    reports,
    sellerWarnings,
    enterpriseRequests,
    eventApprovals,
    eventReports,
    bidDefaulters,
  };
}
