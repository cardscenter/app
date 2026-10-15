"use client";

import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { updateHubSettings } from "@/actions/admin/shop-events";
import { FieldRow } from "@/components/dashboard/ui/field-row";
import type { HubSettings } from "@/lib/app-config";

const INPUT = "glass-input w-full rounded-lg px-3 py-2 text-sm";

export function HubSettingsForm({ initial }: { initial: HubSettings }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await updateHubSettings(fd);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Instellingen opgeslagen");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FieldRow label="Pand-maximum" hint="Maximaal aantal deelnemers per event, ongeacht de event-capaciteit. 0 = geen limiet." htmlFor="maxOccupancy">
        <input id="maxOccupancy" name="maxOccupancy" type="number" min="0" max="2000" defaultValue={initial.maxOccupancy} className={`${INPUT} w-32`} required />
      </FieldRow>
      <FieldRow label="Openingstijden" hint="Vrije tekst, één regel per dag. Komt op de info-pagina (Fase 5)." htmlFor="openingHours">
        <textarea id="openingHours" name="openingHours" defaultValue={initial.openingHours} rows={4} maxLength={2000} className={INPUT} />
      </FieldRow>
      <FieldRow label="Annuleringsbeleid" hint="Staat onder elk betaald event en in de bevestiging." htmlFor="cancellationPolicy">
        <textarea id="cancellationPolicy" name="cancellationPolicy" defaultValue={initial.cancellationPolicy} rows={4} maxLength={2000} className={INPUT} />
      </FieldRow>
      <FieldRow label="Event-info" hint="Algemene info onder elk event: adres, parkeren, op tijd komen." htmlFor="eventInfo">
        <textarea id="eventInfo" name="eventInfo" defaultValue={initial.eventInfo} rows={3} maxLength={2000} className={INPUT} />
      </FieldRow>
      <div className="flex justify-end border-t border-border pt-4">
        <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
          <Save className="size-4" /> Opslaan
        </button>
      </div>
    </form>
  );
}
