"use client";

import { useState, useTransition } from "react";
import { useRouter, Link } from "@/i18n/navigation";
import { ChevronDown, ChevronUp, Store, Check, X, ExternalLink, Loader2 } from "lucide-react";
import { respondToVendorRequest } from "@/actions/event-vendor";

export type VendorRequestRow = {
  id: string;
  status: string; // PENDING | APPROVED | REJECTED
  message: string | null;
  createdAt: string; // ISO
  user: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
    companyName: string | null;
    city: string | null;
  };
};

const STATUS_PILL: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "In behandeling", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  APPROVED: { label: "Goedgekeurd", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  REJECTED: { label: "Afgewezen", cls: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
};

/** Uitklapbaar paneel onder een event-rij in /dashboard/evenementen: de
 *  standhouder-aanvragen voor dat event, met goedkeuren/afwijzen bij PENDING. */
export function EventVendorRequestsPanel({ requests }: { requests: VendorRequestRow[] }) {
  const router = useRouter();
  const pendingCount = requests.filter((r) => r.status === "PENDING").length;
  const [open, setOpen] = useState(pendingCount > 0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function decide(requestId: string, decision: "APPROVED" | "REJECTED") {
    setError(null);
    startTransition(async () => {
      const res = await respondToVendorRequest(requestId, decision);
      if (res?.error) { setError(res.error); return; }
      router.refresh();
    });
  }

  return (
    <div className="ml-3 rounded-b-xl border border-t-0 border-border bg-muted/30 sm:ml-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
      >
        <Store className="h-4 w-4 text-muted-foreground" />
        Standhouder-aanvragen
        {pendingCount > 0 && (
          <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {pendingCount}
          </span>
        )}
        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <ul className="divide-y divide-border border-t border-border">
          {requests.map((r) => {
            const pill = STATUS_PILL[r.status] ?? STATUS_PILL.PENDING;
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                {r.user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.user.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {(r.user.displayName ?? "?").charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <span className="truncate">{r.user.displayName ?? "Onbekend"}</span>
                    <Link href={`/verkoper/${r.user.id}`} className="shrink-0 text-muted-foreground hover:text-primary" aria-label="Bekijk profiel">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[r.user.companyName, r.user.city, new Date(r.createdAt).toLocaleDateString("nl-NL")].filter(Boolean).join(" · ")}
                  </p>
                  {r.message && <p className="mt-1 text-xs text-muted-foreground">&ldquo;{r.message}&rdquo;</p>}
                </div>

                {r.status === "PENDING" ? (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => decide(r.id, "APPROVED")}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Goedkeuren
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => decide(r.id, "REJECTED")}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-rose-500 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" /> Afwijzen
                    </button>
                  </div>
                ) : (
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${pill.cls}`}>{pill.label}</span>
                )}
              </li>
            );
          })}
          {error && <li className="px-3 py-2 text-sm text-rose-500">{error}</li>}
        </ul>
      )}
    </div>
  );
}
