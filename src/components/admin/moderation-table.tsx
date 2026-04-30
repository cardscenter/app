"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { bulkRemoveListings, bulkRemoveAuctions, bulkRemoveClaimsales } from "@/actions/admin/moderation";
import { Trash2, X, AlertTriangle } from "lucide-react";

type Item = {
  id: string;
  title: string;
  status: string;
  sellerName: string;
  sellerId: string;
  sellerOpenReports: number;
  createdAt: string;
  amount: number | null;
};

export function ModerationTable({ kind, items }: { kind: "listings" | "auctions" | "claimsales"; items: Item[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }
  function toggleAll() {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  }

  function handleBulkRemove() {
    setError(null);
    if (reason.trim().length < 5) {
      setError("Reden minimaal 5 tekens.");
      return;
    }
    const ids = Array.from(selected);
    const action =
      kind === "listings" ? bulkRemoveListings :
      kind === "auctions" ? bulkRemoveAuctions :
      bulkRemoveClaimsales;
    startTransition(async () => {
      const res = await action(ids, reason);
      if ("error" in res && res.error) {
        setError(res.error);
      } else {
        setShowModal(false);
        setSelected(new Set());
        setReason("");
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="space-y-3">
        {selected.size > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/50 dark:bg-rose-950/20">
            <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
              {selected.size} geselecteerd
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700"
            >
              <Trash2 className="h-4 w-4" /> Verwijder met reden
            </button>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border bg-white dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left dark:bg-slate-800/60">
              <tr>
                <th className="px-3 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={selected.size === items.length && items.length > 0}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-3 py-2 font-medium">Titel</th>
                <th className="px-3 py-2 font-medium">Verkoper</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">Reports verkoper</th>
                <th className="px-3 py-2 font-medium">Aangemaakt</th>
                <th className="px-3 py-2 font-medium text-right">Bedrag</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center text-muted-foreground">Geen resultaten.</td>
                </tr>
              )}
              {items.map((it) => (
                <tr key={it.id} className={`border-t ${it.sellerOpenReports > 0 ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}`}>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)} />
                  </td>
                  <td className="px-3 py-2 font-medium">{it.title}</td>
                  <td className="px-3 py-2 text-xs">
                    <a href={`/nl/dashboard/admin/users/${it.sellerId}`} className="text-primary hover:underline">
                      {it.sellerName}
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] dark:bg-slate-800">{it.status}</code>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {it.sellerOpenReports > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3" /> {it.sellerOpenReports}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {new Date(it.createdAt).toLocaleDateString("nl-NL")}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">
                    {it.amount != null ? `€${it.amount.toFixed(2)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md space-y-3 rounded-xl border bg-white p-5 shadow-lg dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{selected.size} item(s) verwijderen</h3>
              <button onClick={() => setShowModal(false)} className="rounded-md p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              Verkopers krijgen een notificatie met deze reden. Status wordt gezet op {kind === "listings" ? "DELETED" : kind === "auctions" ? "CANCELLED" : "CLOSED"}.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Reden voor verwijdering (min. 5 tekens, zichtbaar voor verkoper)"
              className="w-full rounded-md border bg-white px-3 py-2 text-sm dark:bg-slate-800"
            />
            {error && <p className="text-xs text-rose-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-slate-50 dark:bg-slate-800">
                Annuleer
              </button>
              <button
                onClick={handleBulkRemove}
                disabled={pending}
                className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {pending ? "Bezig…" : "Verwijder"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
