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
      <h3 className="border-t border-border pt-5 text-sm font-semibold">Info-pagina</h3>
      <FieldRow label="Huisregels" hint="Lege regel = nieuwe alinea. Staat op /info." htmlFor="houseRules">
        <textarea id="houseRules" name="houseRules" defaultValue={initial.houseRules} rows={8} maxLength={5000} className={INPUT} />
      </FieldRow>
      <FieldRow label="Bereikbaarheid en parkeren" hint="Lege regel = nieuwe alinea. Staat op /info." htmlFor="directions">
        <textarea id="directions" name="directions" defaultValue={initial.directions} rows={6} maxLength={5000} className={INPUT} />
      </FieldRow>
      <h3 className="border-t border-border pt-5 text-sm font-semibold">Stempelkaart en spaarpunten</h3>
      <FieldRow label="Stempels per kaart" hint="Een stempel per check-in op een event dat meetelt." htmlFor="stampsPerCard">
        <input id="stampsPerCard" name="stampsPerCard" type="number" min="1" max="100" defaultValue={initial.stampsPerCard} className={`${INPUT} w-32`} required />
      </FieldRow>
      <FieldRow label="Beloning volle kaart" hint="Tekst die de speler ziet bij een volle kaart. Staff levert in aan de bar." htmlFor="stampReward">
        <input id="stampReward" name="stampReward" defaultValue={initial.stampReward} maxLength={500} className={INPUT} required />
      </FieldRow>
      <FieldRow label="Punten per check-in" hint="0 = geen spaarpunten bij check-in." htmlFor="pointsPerCheckIn">
        <input id="pointsPerCheckIn" name="pointsPerCheckIn" type="number" min="0" max="1000" defaultValue={initial.pointsPerCheckIn} className={`${INPUT} w-32`} required />
      </FieldRow>
      <FieldRow label="Bonuspunten volle kaart" hint="Extra spaarpunten zodra een stempelkaart vol is. 0 = uit." htmlFor="pointsPerFullCard">
        <input id="pointsPerFullCard" name="pointsPerFullCard" type="number" min="0" max="1000" defaultValue={initial.pointsPerFullCard} className={`${INPUT} w-32`} required />
      </FieldRow>
      <div className="flex justify-end border-t border-border pt-4">
        <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
          <Save className="size-4" /> Opslaan
        </button>
      </div>
    </form>
  );
}
