"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { createShopEvent, updateShopEvent } from "@/actions/admin/shop-events";
import { ImageUploader } from "@/components/ui/image-uploader";
import { FieldRow } from "@/components/dashboard/ui/field-row";
import { utcToShopWallClock } from "@/lib/shop-events/format";
import { INPUT, PILL_RED, SELECT, TEXTAREA } from "@/components/ploy/tile-styles";
import { cn } from "@/lib/utils";

export interface EventTypeOption {
  id: string;
  name: string;
  game: string | null;
  defaultPrice: number;
  defaultCapacity: number | null;
  countsForLeague: boolean;
  countsForStampCard: boolean;
}

export interface ShopEventFormValues {
  id?: string;
  typeId: string;
  title: string;
  description: string;
  game: string;
  startsAt: string | null; // ISO
  endsAt: string | null;
  registrationOpensAt: string | null;
  registrationDeadline: string | null;
  price: number;
  capacity: number | null;
  minAge: number | null;
  maxAge: number | null;
  underTwelveWithAdult: boolean;
  waitlistEnabled: boolean;
  countsForLeague: boolean;
  countsForStampCard: boolean;
  showParticipants: boolean;
  cancellationHours: number;
  refundPolicy: string;
  coverImage: string | null;
  status?: string;
  hasRegistrations?: boolean;
}

/** Formulier voor een winkel-event (nieuw + bewerken). Tijden in winkel-tijd (Europe/Amsterdam). */
export function ShopEventForm({ initial, types, games }: { initial: ShopEventFormValues; types: EventTypeOption[]; games: Array<{ key: string; name: string }> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const start = initial.startsAt ? utcToShopWallClock(new Date(initial.startsAt)) : { date: "", time: "19:00" };
  const end = initial.endsAt ? utcToShopWallClock(new Date(initial.endsAt)) : { date: "", time: "22:30" };
  const opens = initial.registrationOpensAt ? utcToShopWallClock(new Date(initial.registrationOpensAt)) : { date: "", time: "" };
  const deadline = initial.registrationDeadline ? utcToShopWallClock(new Date(initial.registrationDeadline)) : { date: "", time: "" };

  const [typeId, setTypeId] = useState(initial.typeId || types[0]?.id || "");
  const [price, setPrice] = useState(String(initial.price));
  const [capacity, setCapacity] = useState(initial.capacity?.toString() ?? "");
  const [league, setLeague] = useState(initial.countsForLeague);
  const [stamp, setStamp] = useState(initial.countsForStampCard);
  const [game, setGame] = useState(initial.game);
  const [cover, setCover] = useState<string[]>(initial.coverImage ? [initial.coverImage] : []);
  const priceLocked = initial.status === "PUBLISHED" && !!initial.hasRegistrations;

  function applyTypeDefaults(id: string) {
    setTypeId(id);
    const t = types.find((x) => x.id === id);
    if (!t || initial.id) return; // alleen bij nieuw event defaults overnemen
    setPrice(String(t.defaultPrice));
    setCapacity(t.defaultCapacity?.toString() ?? "");
    setLeague(t.countsForLeague);
    setStamp(t.countsForStampCard);
    setGame(t.game ?? "");
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("coverImage", cover[0] ?? "");
    startTransition(async () => {
      const r = initial.id ? await updateShopEvent(initial.id, fd) : await createShopEvent(fd);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(initial.id ? "Event opgeslagen" : "Event aangemaakt als concept");
      if (!initial.id && "id" in r) router.push(`/dashboard/admin/events/${r.id}`);
      else router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FieldRow label="Type" hint="Bepaalt divisies en standaardwaarden" htmlFor="typeId">
        <select id="typeId" name="typeId" value={typeId} onChange={(e) => applyTypeDefaults(e.target.value)} className={SELECT} required>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </FieldRow>
      <FieldRow label="Titel" htmlFor="title">
        <input id="title" name="title" defaultValue={initial.title} className={INPUT} required maxLength={100} placeholder="bv. League-avond Pokémon" />
      </FieldRow>
      <FieldRow label="Spel" hint="Leeg = volgt het type" htmlFor="game">
        <select id="game" name="game" value={game} onChange={(e) => setGame(e.target.value)} className={SELECT}>
          <option value="">Geen / alle spellen</option>
          {games.map((g) => (
            <option key={g.key} value={g.key}>
              {g.name}
            </option>
          ))}
        </select>
      </FieldRow>
      <FieldRow label="Datum en tijd" hint="Winkel-tijd (Hulst). Eindtijd vóór de starttijd = loopt door tot na middernacht.">
        <div className="grid grid-cols-3 gap-2">
          <input type="date" name="date" defaultValue={start.date} className={INPUT} required />
          <input type="time" name="startTime" defaultValue={start.time} className={INPUT} required />
          <input type="time" name="endTime" defaultValue={end.time} className={INPUT} required />
        </div>
      </FieldRow>
      <FieldRow label="Inschrijving open vanaf" hint="Leeg = direct na publiceren">
        <div className="grid grid-cols-2 gap-2">
          <input type="date" name="registrationOpensDate" defaultValue={opens.date} className={INPUT} />
          <input type="time" name="registrationOpensTime" defaultValue={opens.time} className={INPUT} />
        </div>
      </FieldRow>
      <FieldRow label="Inschrijfdeadline" hint="Leeg = tot de start">
        <div className="grid grid-cols-2 gap-2">
          <input type="date" name="registrationDeadlineDate" defaultValue={deadline.date} className={INPUT} />
          <input type="time" name="registrationDeadlineTime" defaultValue={deadline.time} className={INPUT} />
        </div>
      </FieldRow>
      <FieldRow label="Prijs (EUR)" hint={priceLocked ? "Niet meer te wijzigen: er zijn inschrijvingen" : "0 = gratis, dan geen betaling"} htmlFor="price">
        <input id="price" name="price" type="number" step="0.01" min="0" max="500" value={price} onChange={(e) => setPrice(e.target.value)} className={INPUT} readOnly={priceLocked} required />
      </FieldRow>
      <FieldRow label="Capaciteit" hint="Leeg = alleen het pand-maximum uit de instellingen" htmlFor="capacity">
        <input id="capacity" name="capacity" type="number" min="1" max="500" value={capacity} onChange={(e) => setCapacity(e.target.value)} className={INPUT} />
      </FieldRow>
      <FieldRow label="Leeftijd" hint="Minimum en maximum, leeg = geen grens">
        <div className="grid grid-cols-2 gap-2">
          <input name="minAge" type="number" min="0" max="99" defaultValue={initial.minAge ?? ""} placeholder="min" className={INPUT} />
          <input name="maxAge" type="number" min="0" max="99" defaultValue={initial.maxAge ?? ""} placeholder="max" className={INPUT} />
        </div>
      </FieldRow>
      <FieldRow label="Regels">
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="underTwelveWithAdult" value="true" defaultChecked={initial.underTwelveWithAdult} className="accent-primary" /> Onder de 12 welkom met begeleiding van een volwassene</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="waitlistEnabled" value="true" defaultChecked={initial.waitlistEnabled} className="accent-primary" /> Wachtlijst als het vol is</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="countsForLeague" value="true" checked={league} onChange={(e) => setLeague(e.target.checked)} className="accent-primary" /> Telt mee voor de league</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="countsForStampCard" value="true" checked={stamp} onChange={(e) => setStamp(e.target.checked)} className="accent-primary" /> Stempel op de stempelkaart bij check-in</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="showParticipants" value="true" defaultChecked={initial.showParticipants} className="accent-primary" /> Toon &ldquo;wie komt er&rdquo; (alleen spelers met opt-in)</label>
        </div>
      </FieldRow>
      <FieldRow label="Annuleren tot (uur vooraf)" hint="Tot zoveel uur voor de start krijgt de speler het geld terug" htmlFor="cancellationHours">
        <input id="cancellationHours" name="cancellationHours" type="number" min="0" max="720" defaultValue={initial.cancellationHours} className={INPUT} required />
      </FieldRow>
      <FieldRow label="Extra regels" hint="Bijvoorbeeld: inclusief 6 boosters, neem je eigen deck mee" htmlFor="refundPolicy">
        <textarea id="refundPolicy" name="refundPolicy" defaultValue={initial.refundPolicy} rows={2} maxLength={1000} className={TEXTAREA} />
      </FieldRow>
      <FieldRow label="Beschrijving" htmlFor="description">
        <textarea id="description" name="description" defaultValue={initial.description} rows={6} maxLength={4000} className={TEXTAREA} placeholder="Format, prijzen, wat je meeneemt, hoe de avond verloopt." />
      </FieldRow>
      <FieldRow label="Omslagfoto" hint="Breed (3:1), optioneel">
        <ImageUploader images={cover} onChange={(imgs) => setCover(imgs.slice(-1))} maxImages={1} context="event" />
      </FieldRow>
      <div className="flex justify-end border-t border-border pt-4">
        <button type="submit" disabled={pending} className={cn(PILL_RED, "disabled:opacity-60")}>
          <Save className="size-4" /> {initial.id ? "Opslaan" : "Aanmaken als concept"}
        </button>
      </div>
    </form>
  );
}
