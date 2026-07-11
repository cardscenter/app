"use client";

import { useState, useTransition } from "react";
import { useRouter, Link } from "@/i18n/navigation";
import { Star, CircleCheck, Loader2 } from "lucide-react";
import { setEventRsvp } from "@/actions/event-rsvp";

export type RsvpUserLite = { id: string; displayName: string | null; avatarUrl: string | null };
type RsvpStatus = "INTERESTED" | "GOING" | null;

function AvatarBubble({ user }: { user: RsvpUserLite }) {
  return user.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={user.avatarUrl}
      alt={user.displayName ?? ""}
      title={user.displayName ?? undefined}
      className="h-7 w-7 rounded-full object-cover ring-2 ring-background"
    />
  ) : (
    <span
      title={user.displayName ?? undefined}
      className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary ring-2 ring-background"
    >
      {(user.displayName ?? "?").charAt(0).toUpperCase()}
    </span>
  );
}

/** Facebook-stijl RSVP in de hero: "Geïnteresseerd" / "Ik ben aanwezig" met
 *  counts + avatar-preview-stack. Volledige lijsten staan in de Bezoekers-tab. */
export function EventRsvpButtons({
  eventId,
  viewerStatus,
  isLoggedIn,
  isOrganizer,
  eventOver,
  interestedCount,
  goingCount,
  stack,
}: {
  eventId: string;
  viewerStatus: RsvpStatus;
  isLoggedIn: boolean;
  isOrganizer: boolean;
  eventOver: boolean;
  interestedCount: number;
  goingCount: number;
  stack: RsvpUserLite[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<RsvpStatus>(viewerStatus);
  const [error, setError] = useState<string | null>(null);

  // Counts optimistisch corrigeren t.o.v. de server-waarden.
  const delta = (target: "INTERESTED" | "GOING") =>
    (optimistic === target ? 1 : 0) - (viewerStatus === target ? 1 : 0);
  const shownInterested = interestedCount + delta("INTERESTED");
  const shownGoing = goingCount + delta("GOING");

  function toggle(target: "INTERESTED" | "GOING") {
    const next: RsvpStatus = optimistic === target ? null : target;
    const previous = optimistic;
    setOptimistic(next);
    setError(null);
    startTransition(async () => {
      const res = await setEventRsvp(eventId, next ?? "NONE");
      if (res?.error) {
        setOptimistic(previous);
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  const summary = (
    <div className="flex items-center gap-2.5">
      {stack.length > 0 && (
        <div className="flex -space-x-2">
          {stack.slice(0, 6).map((u) => (
            <AvatarBubble key={u.id} user={u} />
          ))}
          {shownInterested + shownGoing > 6 && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground ring-2 ring-background">
              +{shownInterested + shownGoing - 6}
            </span>
          )}
        </div>
      )}
      {(shownInterested > 0 || shownGoing > 0) && (
        <p className="text-sm text-muted-foreground">
          {[
            shownInterested > 0 ? `${shownInterested} geïnteresseerd` : null,
            shownGoing > 0 ? `${shownGoing} aanwezig` : null,
          ].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );

  // Organisator of afgelopen event: alleen de samenvatting (geen knoppen).
  if (isOrganizer || eventOver) {
    return shownInterested + shownGoing > 0 ? <div>{summary}</div> : null;
  }

  const btnBase = "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:opacity-60";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex gap-2">
        {isLoggedIn ? (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() => toggle("INTERESTED")}
              className={`${btnBase} ${
                optimistic === "INTERESTED"
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : "border border-border text-foreground hover:bg-muted"
              }`}
            >
              {isPending && optimistic === "INTERESTED" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className={`h-4 w-4 ${optimistic === "INTERESTED" ? "fill-current" : ""}`} />}
              Geïnteresseerd
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => toggle("GOING")}
              className={`${btnBase} ${
                optimistic === "GOING"
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "border border-border text-foreground hover:bg-muted"
              }`}
            >
              {isPending && optimistic === "GOING" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleCheck className="h-4 w-4" />}
              Ik ben aanwezig
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className={`${btnBase} border border-border text-foreground hover:bg-muted`}>
              <Star className="h-4 w-4" /> Geïnteresseerd
            </Link>
            <Link href="/login" className={`${btnBase} border border-border text-foreground hover:bg-muted`}>
              <CircleCheck className="h-4 w-4" /> Ik ben aanwezig
            </Link>
          </>
        )}
      </div>
      {summary}
      {error && <p className="w-full text-sm text-rose-500">{error}</p>}
    </div>
  );
}
