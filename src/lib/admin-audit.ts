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
  | "FORCE_USERNAME_RESET"
  // Fase 29 — veiling-binding + anti-shill
  | "BID_IP_OVERLAP"
  | "SYSTEM_AUTO_SUSPEND"
  | "GRANT_BID_DEPOSIT_EXEMPTION"
  | "REVOKE_BID_DEPOSIT_EXEMPTION";

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

/**
 * Log an admin or system action.
 *
 * Pass `adminId` as a userId for human-driven actions, or `"system"` for
 * automated actions (cron auto-suspend, IP-overlap-flagging). System events
 * land in the same audit log met `actorType="SYSTEM"` en `adminId=null`.
 */
export async function logAdminAction(params: {
  adminId: string;
  action: AdminAction;
  targetType: AdminTargetType;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const isSystem = params.adminId === "system";
  await prisma.adminAuditLog.create({
    data: {
      adminId: isSystem ? null : params.adminId,
      actorType: isSystem ? "SYSTEM" : "USER",
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    },
  });
}
