"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { bulkRemoveListings, bulkRemoveAuctions, bulkRemoveClaimsales } from "@/actions/admin/moderation";
import { Trash2, X, AlertTriangle } from "lucide-react";
import { Callout } from "@/components/dashboard/ui/callout";
import { PILL_BTN, PILL_RED, PILL_RED_SM, TEXTAREA, TABLE_HEAD } from "@/components/ploy/tile-styles";

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
          <Callout
            tone="pink"
            title={`${selected.size} geselecteerd`}
            action={
              <button
                onClick={() => setShowModal(true)}
                className={PILL_RED_SM}
              >
                <Trash2 className="h-4 w-4" /> Verwijder met reden
              </button>
            }
          />
        )}

        <div className="overflow-x-auto dash-card">
          <table className="w-full text-sm">
            <thead className={`${TABLE_HEAD} bg-[var(--background)]`}>
              <tr>
                <th className="w-8 px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.size === items.length && items.length > 0}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-4 py-2.5">Titel</th>
                <th className="px-4 py-2.5">Verkoper</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Reports verkoper</th>
                <th className="px-4 py-2.5">Aangemaakt</th>
                <th className="px-4 py-2.5 text-right">Bedrag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Geen resultaten.</td>
                </tr>
              )}
              {items.map((it) => (
                <tr key={it.id} className={`transition-colors hover:bg-[var(--background)] ${it.sellerOpenReports > 0 ? "bg-[var(--pastel-yellow)]/20" : ""}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)} />
                  </td>
                  <td className="px-4 py-3 font-medium">{it.title}</td>
                  <td className="px-4 py-3 text-xs">
                    <a href={`/nl/dashboard/admin/users/${it.sellerId}`} className="text-primary hover:underline">
                      {it.sellerName}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <code className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{it.status}</code>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {it.sellerOpenReports > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--pastel-yellow-ink)]">
                        <AlertTriangle className="h-3 w-3" /> {it.sellerOpenReports}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-muted-foreground">
                    {new Date(it.createdAt).toLocaleDateString("nl-NL")}
                  </td>
                  <td className="px-4 py-3 text-right text-xs tabular-nums">
                    {it.amount != null ? `€${it.amount.toFixed(2)}` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md space-y-3 rounded-[20px] bg-white p-5 shadow-card-hover">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold tracking-[-0.03em]">{selected.size} item(s) verwijderen</h3>
              <button onClick={() => setShowModal(false)} className="rounded-full p-1.5 hover:bg-[var(--background)]">
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
              className={TEXTAREA}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className={PILL_BTN}>
                Annuleer
              </button>
              <button
                onClick={handleBulkRemove}
                disabled={pending}
                className={`${PILL_RED} disabled:opacity-50`}
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
