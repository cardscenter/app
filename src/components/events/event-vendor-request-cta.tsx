"use client";

import { useState, useTransition } from "react";
import { useRouter, Link } from "@/i18n/navigation";
import { Store, Loader2, Clock, CircleCheck, X } from "lucide-react";
import { requestVendorSpot, withdrawVendorRequest } from "@/actions/event-vendor";

/** Status-aware CTA voor standhouders: vermelding aanvragen bij de organisator.
 *  E-mail-verificatie wordt server-side afgedwongen; de foutmelding verschijnt inline. */
export function EventVendorRequestCta({
  eventId,
  viewerStatus,
  requestId,
  isLoggedIn,
  isOrganizer,
  eventOver,
}: {
  eventId: string;
  viewerStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
  requestId: string | null;
  isLoggedIn: boolean;
  isOrganizer: boolean;
  eventOver: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (isOrganizer || eventOver) return null;

  if (!isLoggedIn) {
    return (
      <p className="text-sm text-muted-foreground">
        Sta jij hier met een stand?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">Log in</Link>{" "}
        om een vermelding aan te vragen.
      </p>
    );
  }

  if (viewerStatus === "APPROVED") {
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
        <CircleCheck className="h-4 w-4 shrink-0" /> Je staat in de standhouderslijst van dit evenement.
      </p>
    );
  }

  if (viewerStatus === "PENDING") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
          <Clock className="h-4 w-4 shrink-0" /> Aanvraag in behandeling bij de organisator.
        </p>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              if (!requestId) return;
              const res = await withdrawVendorRequest(requestId);
              if (res?.error) { setError(res.error); return; }
              setError(null);
              router.refresh();
            })
          }
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-rose-500 disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" /> Intrekken
        </button>
        {error && <p className="w-full text-sm text-rose-500">{error}</p>}
      </div>
    );
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      if (message.trim()) fd.set("message", message.trim());
      const res = await requestVendorSpot(eventId, fd);
      if (res?.error) { setError(res.error); return; }
      setMessage("");
      router.refresh();
    });
  }

  return (
    <div>
      <p className="flex items-center gap-2 font-semibold text-foreground">
        <Store className="h-4 w-4 shrink-0" /> Sta jij hier met een stand?
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Vraag een vermelding aan — na goedkeuring door de organisator verschijnt je winkelprofiel in de standhouderslijst.
      </p>
      {viewerStatus === "REJECTED" && (
        <p className="mt-1 text-xs text-muted-foreground">Je eerdere aanvraag is afgewezen — je kunt het opnieuw proberen.</p>
      )}
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={300}
        rows={2}
        placeholder="Korte toelichting voor de organisator (optioneel) — bv. welke producten je verkoopt"
        className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={submit}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />} Vraag vermelding aan
        </button>
        <span className="text-xs text-muted-foreground">{message.length}/300</span>
      </div>
      {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}
    </div>
  );
}
