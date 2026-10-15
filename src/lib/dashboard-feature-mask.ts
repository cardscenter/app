/**
 * Maskeert dashboard-tellers per feature-flag (Community Hub, Fase 1).
 * Server-side toepassen vóór de counts naar widgets/hero gaan, zodat de
 * client-components geen eigen flag-logica nodig hebben: een verborgen
 * functie geeft gewoon 0 terug en de tegel verdwijnt vanzelf.
 *
 * Puur bestand (alleen type-imports) zodat het ook client-side bruikbaar is.
 */
import type { FeatureSnapshot } from "./feature-flags";
import type { ActionItemsCounts, ActiveActivity } from "./dashboard-queries";

export function maskActionItems(counts: ActionItemsCounts, f: FeatureSnapshot): ActionItemsCounts {
  return {
    unreadConversations: counts.unreadConversations,
    unreadNotifications: counts.unreadNotifications,
    openDisputes: f.FEATURE_WALLET ? counts.openDisputes : 0,
    awaitingPaymentAuctions: f.FEATURE_AUCTIONS ? counts.awaitingPaymentAuctions : 0,
    runnerUpOffers: f.FEATURE_AUCTIONS ? counts.runnerUpOffers : 0,
    bundlesToShip: f.FEATURE_WALLET ? counts.bundlesToShip : 0,
    pendingCancellations: f.FEATURE_WALLET ? counts.pendingCancellations : 0,
    pendingPickups: f.FEATURE_WALLET ? counts.pendingPickups : 0,
  };
}

export function maskActiveActivity(activity: ActiveActivity, f: FeatureSnapshot): ActiveActivity {
  return {
    counts: {
      auctions: f.FEATURE_AUCTIONS ? activity.counts.auctions : 0,
      listings: f.FEATURE_MARKETPLACE ? activity.counts.listings : 0,
      claimsales: f.FEATURE_CLAIMSALES ? activity.counts.claimsales : 0,
      events: activity.counts.events,
    },
    bids: f.FEATURE_AUCTIONS ? activity.bids : { highest: 0, outbid: 0, totalActive: 0 },
  };
}
