import { prisma } from "@/lib/prisma";

export type AdminAction =
  | "SUSPEND_USER"
  | "LIFT_SUSPENSION"
  | "APPROVE_WITHDRAWAL"
  | "REJECT_WITHDRAWAL"
  | "MARK_PAID"
  | "ADMIN_RESOLVE_DISPUTE"
  | "REVIEW_VERIFICATION"
  | "UPDATE_BUYBACK_STATUS"
  | "CONFIRM_BANK_TRANSFER"
  | "REVIEW_REPORT"
  | "UPDATE_APP_CONFIG"
  | "EDIT_SERIES"
  | "EDIT_CARDSET"
  | "EDIT_CARD"
  | "RUN_CRON_MANUALLY"
  | "BULK_REMOVE_LISTINGS"
  | "BULK_REMOVE_AUCTIONS"
  | "BULK_REMOVE_CLAIMSALES"
  | "RESET_IBAN_COOLDOWN"
  | "FORCE_USERNAME_RESET";

export type AdminTargetType =
  | "USER"
  | "WITHDRAWAL"
  | "DISPUTE"
  | "VERIFICATION"
  | "BUYBACK"
  | "LISTING"
  | "AUCTION"
  | "CLAIMSALE"
  | "APP_CONFIG"
  | "SERIES"
  | "CARDSET"
  | "CARD"
  | "CRON"
  | "REPORT";

export async function logAdminAction(params: {
  adminId: string;
  action: AdminAction;
  targetType: AdminTargetType;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await prisma.adminAuditLog.create({
    data: {
      adminId: params.adminId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    },
  });
}
