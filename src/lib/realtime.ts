/**
 * Real-time pub/sub voor SSE-events (Fase 30A).
 *
 * Single-instance in-memory pub/sub. Werkt op Railway/VPS/single-container
 * waar één Node-proces draait. Bij multi-instance (Vercel, replicas) moet dit
 * vervangen worden door Redis pub/sub of Postgres LISTEN/NOTIFY — de publish
 * en subscribe interface blijft dan hetzelfde, alleen de implementatie eronder.
 *
 * Channel-naming-convention:
 *   user:${userId}        — private events naar één gebruiker
 *   auction:${auctionId}  — broadcasts naar iedereen die op een auction-page kijkt
 *   (later) claimsale:${id}, listing:${id}, ...
 */

export type RealtimeEvent =
  | { type: "outbid"; payload: { auctionId: string; auctionTitle: string; newAmount: number } }
  | { type: "balance-changed"; payload: Record<string, never> }
  | {
      type: "auction-won";
      payload: { auctionId: string; auctionTitle: string; finalPrice: number; paymentDeadline: string | null };
    }
  | {
      type: "bid-placed";
      payload: { auctionId: string; bidId: string; amount: number; bidderName: string; currentBid: number; bidCount: number };
    }
  | {
      type: "achievement-unlocked";
      payload: { achievementKey: string; tier: number; name: string; description: string };
    }
  | { type: "notification-created"; payload: { unreadCount: number } }
  | {
      type: "new-message";
      payload: { conversationId: string; senderName: string; preview: string; unreadConversationCount: number };
    }
  | {
      type: "claimsale-item-claimed";
      payload: { claimsaleId: string; itemId: string; status: "CLAIMED" | "SOLD" | "AVAILABLE" };
    }
  | {
      type: "auction-ended";
      payload: { auctionId: string; status: string; finalPrice: number | null };
    }
  | {
      type: "cart-changed";
      payload: { count: number };
    }
  | {
      type: "listing-changed";
      payload: { listingId: string; status: string };
    }
  | {
      type: "bundle-changed";
      payload: { bundleId: string; status: string };
    }
  | {
      type: "dispute-changed";
      payload: { disputeId: string; status: string };
    }
  | {
      type: "withdrawal-changed";
      payload: { withdrawalId: string; status: string };
    }
  | {
      type: "verification-changed";
      payload: { status: string };
    }
  | {
      type: "suspension-changed";
      payload: { suspended: boolean };
    };

export function claimsaleChannel(claimsaleId: string): string {
  return `claimsale:${claimsaleId}`;
}

export function listingChannel(listingId: string): string {
  return `listing:${listingId}`;
}

type Subscriber = {
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
};

// Subscriber-registry op globalThis zodat HMR-reloads in dev mode niet leiden
// tot twee aparte Map-instances. Zonder dit: SSE-route subscribet op Map A,
// placeBid-action publishet naar Map B → 0 subscribers altijd.
type GlobalWithChannels = typeof globalThis & {
  __realtimeChannels?: Map<string, Set<Subscriber>>;
};
const g = globalThis as GlobalWithChannels;
if (!g.__realtimeChannels) g.__realtimeChannels = new Map();
const channels = g.__realtimeChannels;

export function subscribe(channel: string, sub: Subscriber): () => void {
  let set = channels.get(channel);
  if (!set) {
    set = new Set();
    channels.set(channel, set);
  }
  set.add(sub);
  return () => {
    const current = channels.get(channel);
    if (!current) return;
    current.delete(sub);
    if (current.size === 0) channels.delete(channel);
  };
}

/**
 * Publish een event naar alle subscribers van een channel. Fire-and-forget:
 * faalt silent bij geen subscribers, gooit nooit een error die de calling
 * action zou kunnen breken.
 */
export function publish(channel: string, event: RealtimeEvent): void {
  const set = channels.get(channel);
  if (!set || set.size === 0) return;
  const frame = `data: ${JSON.stringify(event)}\n\n`;
  for (const sub of set) {
    try {
      sub.controller.enqueue(sub.encoder.encode(frame));
    } catch {
      // Stream gesloten — cleanup gebeurt via subscribe-cleanup-fn op req.signal.aborted.
    }
  }
}

/**
 * Broadcast naar meerdere channels in één keer (handig wanneer een event
 * relevant is voor zowel een user-channel als een resource-channel).
 */
export function publishMany(channels: string[], event: RealtimeEvent): void {
  for (const ch of channels) publish(ch, event);
}

export function userChannel(userId: string): string {
  return `user:${userId}`;
}

export function auctionChannel(auctionId: string): string {
  return `auction:${auctionId}`;
}
