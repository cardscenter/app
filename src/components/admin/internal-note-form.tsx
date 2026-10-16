"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { StickyNote, Save } from "lucide-react";
import { setInternalNote } from "@/actions/admin/community";

/** Interne notitie op een gebruiker: alleen zichtbaar voor admins (Fase 5, moderatie). */
export function InternalNoteForm({ userId, initial }: { userId: string; initial: string | null }) {
  const router = useRouter();
  const [note, setNote] = useState(initial ?? "");
  const [pending, start] = useTransition();
  const dirty = note !== (initial ?? "");
  return (
    <div className="dash-card p-4">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold">
        <StickyNote className="size-4 text-amber-500" /> Interne notitie
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">Alleen zichtbaar voor admins. Gebruik dit voor afspraken, waarschuwingen of context bij schorsingen. Niet voor de speler.</p>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} maxLength={2000} className="glass-input mt-3 w-full rounded-lg px-3 py-2 text-sm" placeholder="bv. 12-03: gewaarschuwd voor taalgebruik aan tafel 4." />
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          disabled={pending || !dirty}
          onClick={() =>
            start(async () => {
              const r = await setInternalNote(userId, note);
              if ("error" in r) return void toast.error(r.error);
              toast.success("Notitie opgeslagen");
              router.refresh();
            })
          }
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
        >
          <Save className="size-4" /> Opslaan
        </button>
      </div>
    </div>
  );
}
