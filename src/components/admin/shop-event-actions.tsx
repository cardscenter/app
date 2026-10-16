"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Globe, EyeOff, Ban, CheckSquare, Copy, Download, ExternalLink } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { publishShopEvent, cancelShopEvent, completeShopEvent, duplicateShopEvent } from "@/actions/admin/shop-events";

/** Knoppenbalk op de admin-detailpagina: publiceren, annuleren, afronden, dupliceren, CSV. */
export function ShopEventActions({ eventId, status, endsAtIso }: { eventId: string; status: string; endsAtIso: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const ended = new Date(endsAtIso) <= new Date();

  const run = (fn: () => Promise<{ error?: string } | { success: true; id?: string }>, ok: string, after?: (r: { id?: string }) => void) =>
    startTransition(async () => {
      const r = await fn();
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(ok);
      after?.(r as { id?: string });
      router.refresh();
    });

  const btn = "inline-flex items-center gap-1.5 cc-pill border border-border bg-white px-4 py-2 text-sm font-semibold hover:bg-background disabled:opacity-60";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Link href={`/evenementen/${eventId}`} className={btn}>
          <ExternalLink className="size-4" /> Bekijk pagina
        </Link>
        {status === "DRAFT" && (
          <button type="button" disabled={pending} onClick={() => run(() => publishShopEvent(eventId, true), "Gepubliceerd")} className="inline-flex items-center gap-1.5 cc-pill cc-grad px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            <Globe className="size-4" /> Publiceren
          </button>
        )}
        {status === "PUBLISHED" && (
          <button type="button" disabled={pending} onClick={() => run(() => publishShopEvent(eventId, false), "Terug naar concept")} className={btn}>
            <EyeOff className="size-4" /> Terug naar concept
          </button>
        )}
        {status === "PUBLISHED" && ended && (
          <button type="button" disabled={pending} onClick={() => run(() => completeShopEvent(eventId), "Event afgerond")} className={btn}>
            <CheckSquare className="size-4" /> Afronden (no-shows markeren)
          </button>
        )}
        <button type="button" disabled={pending} onClick={() => run(() => duplicateShopEvent(eventId), "Kopie aangemaakt", (r) => r.id && router.push(`/dashboard/admin/events/${r.id}`))} className={btn}>
          <Copy className="size-4" /> Dupliceren
        </button>
        <a href={`/api/staff/events/${eventId}/export`} className={btn}>
          <Download className="size-4" /> CSV
        </a>
        {(status === "DRAFT" || status === "PUBLISHED") && (
          <button type="button" disabled={pending} onClick={() => setCancelOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/40 px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-500/10 disabled:opacity-60">
            <Ban className="size-4" /> Annuleren
          </button>
        )}
      </div>
      {cancelOpen && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-4">
          <p className="text-sm text-foreground">Alle inschrijvingen worden geannuleerd en betaalde tickets automatisch terugbetaald. Deelnemers krijgen een melding met deze reden:</p>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="bv. Te weinig aanmeldingen" className="glass-input mt-2 w-full rounded-md px-3 py-2 text-sm" />
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={pending || reason.trim().length < 3} onClick={() => run(() => cancelShopEvent(eventId, reason), "Event geannuleerd", () => setCancelOpen(false))} className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
              Ja, annuleer het event
            </button>
            <button type="button" onClick={() => setCancelOpen(false)} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
              Terug
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
