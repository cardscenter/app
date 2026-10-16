import { prisma } from "@/lib/prisma";

export type AdminAction =
  | "SUSPEND_USER"
  | "LIFT_SUSPENSION"
  | "APPROVE_WITHDRAWAL"
  | "REJECT_WITHDRAWAL"
  | "MARK_PAID"
  | "ADMIN_RESOLVE_DISPUTE"
  | "TAKE_OVER_DISPUTE"
  | "ADD_DISPUTE_NOTE"
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
  | "ADMIN_CHANGE_USERNAME"
  | "ADMIN_CHANGE_FULL_NAME"
  | "SYNC_RESERVED_BALANCE"
  // Fase 29 — veiling-binding + anti-shill
  | "BID_IP_OVERLAP"
  | "SYSTEM_AUTO_SUSPEND"
  | "GRANT_BID_DEPOSIT_EXEMPTION"
  | "REVOKE_BID_DEPOSIT_EXEMPTION"
  // Fase 31 — Enterprise-aanvraag
  | "APPROVE_ENTERPRISE_REQUEST"
  | "REJECT_ENTERPRISE_REQUEST"
  // Fase 40 — ShippingIssue admin-tickets
  | "RESOLVE_SHIPPING_ISSUE"
  // Evenementenkalender
  | "APPROVE_EVENT"
  | "REJECT_EVENT"
  | "EDIT_EVENT"
  | "SET_EVENT_OFFICIAL"
  | "GRANT_TRUSTED_ORGANIZER"
  | "REVOKE_TRUSTED_ORGANIZER"
  | "REVIEW_EVENT_REPORT"
  // Community Hub (Fase 2) — rollen en spellen
  | "SET_USER_ROLE"
  | "TOGGLE_GAME"
  // Community Hub (Fase 3): winkel-events
  | "CREATE_EVENT_TYPE"
  | "UPDATE_EVENT_TYPE"
  | "CREATE_SHOP_EVENT"
  | "UPDATE_SHOP_EVENT"
  | "PUBLISH_SHOP_EVENT"
  | "CANCEL_SHOP_EVENT"
  | "COMPLETE_SHOP_EVENT"
  | "DUPLICATE_SHOP_EVENT"
  | "ADMIN_CANCEL_REGISTRATION"
  | "ADMIN_ADD_REGISTRATION"
  | "UPDATE_HUB_SETTINGS"
  // Community Hub (Fase 4): eten bestellen
  | "UPDATE_MENU_ITEM"
  | "SAVE_DISCOUNT_CODE"
  | "CLEAR_FOOD_ORDERS"
  // Community Hub (Fase 5): league, loyaliteit, nieuws, moderatie
  | "SAVE_LEAGUE_SEASON"
  | "SET_LEAGUE_SEASON_STATUS"
  | "DELETE_LEAGUE_SEASON"
  | "SAVE_LEAGUE_BADGE"
  | "DELETE_LEAGUE_BADGE"
  | "SAVE_NEWS_POST"
  | "DELETE_NEWS_POST"
  | "SEND_NEWSLETTER"
  | "SET_INTERNAL_NOTE"
  // Design-pass Fase C: ervaringen
  | "SAVE_TESTIMONIAL"
  | "DELETE_TESTIMONIAL"
  // Community Hub (Fase 6): inkoop
  | "MARK_BUYBACK_RETURNED"
  | "UPDATE_BULK_PRICE"
  // Fase 45 — tier-beheer door admin
  | "GRANT_TIER"
  | "REVOKE_TIER";

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
  | "REPORT"
  | "ENTERPRISE_REQUEST"
  | "SHIPPING_ISSUE"
  | "EVENT"
  | "EVENT_REPORT"
  | "GAME"
  | "EVENT_TYPE"
  | "SHOP_EVENT"
  | "EVENT_REGISTRATION"
  | "HUB_SETTINGS"
  | "MENU_ITEM"
  | "DISCOUNT_CODE"
  | "FOOD_ORDER"
  | "LEAGUE_SEASON"
  | "LEAGUE_BADGE"
  | "NEWS_POST"
  | "TESTIMONIAL"
  | "BULK_PRICE";

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
