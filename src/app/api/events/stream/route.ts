import { auth } from "@/lib/auth";
import { subscribe, userChannel, auctionChannel } from "@/lib/realtime";

export const dynamic = "force-dynamic";
// Long-lived connection — geen Edge runtime want we draaien op Node (Railway).
export const runtime = "nodejs";

const HEARTBEAT_INTERVAL_MS = 25_000;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;

  // Optionele extra channels via query param ?channels=auction:abc,claimsale:def
  // Whitelist op resource-prefix om DoS via willekeurige user:-channel sniffing
  // te voorkomen. User-channel wordt automatisch ingesteld op basis van auth.
  const PUBLIC_PREFIXES = ["auction:", "claimsale:", "listing:"] as const;
  const url = new URL(req.url);
  const extraChannels = (url.searchParams.get("channels") ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
    .filter((c) => PUBLIC_PREFIXES.some((p) => c.startsWith(p)));

  const subscriberChannels = [userChannel(userId), ...extraChannels];

  const encoder = new TextEncoder();
  let cleanups: Array<() => void> = [];
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Initial event om de browser te laten weten dat de stream open is.
      controller.enqueue(encoder.encode(`: connected\n\n`));

      const sub = { controller, encoder };
      cleanups = subscriberChannels.map((ch) => subscribe(ch, sub));

      // Heartbeat tegen proxy/load-balancer-timeouts (Railway, nginx default 60s).
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          // Stream gesloten — cancel-handler doet cleanup.
        }
      }, HEARTBEAT_INTERVAL_MS);

      // Browser-disconnect detectie via AbortSignal.
      req.signal.addEventListener("abort", () => {
        if (heartbeat) clearInterval(heartbeat);
        for (const fn of cleanups) fn();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      });
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      for (const fn of cleanups) fn();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
