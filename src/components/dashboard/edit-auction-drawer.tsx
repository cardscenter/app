"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, Loader2, AlertCircle, Lock, Info } from "lucide-react";
import { updateAuction } from "@/actions/auction";
import { computeEditScope, type EditScope } from "@/lib/auction/edit-scope";
import { ImageUploader } from "@/components/ui/image-uploader";
import {
  formatNLDateTime,
  formatNLDateTimeLocal,
  parseNLDateTimeLocal,
} from "@/lib/auction/timing";

// CLAUDE.md: upload.ts is server-only — inline parseImageUrls.
function parseImageUrls(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Snapshot van de bewerkbare velden op het moment dat de drawer opent. Wordt
 *  door de page-query gevuld en doorgegeven aan SellerAuctionCard. */
export interface EditAuctionInitialData {
  title: string;
  description: string | null;
  imageUrls: string | null;
  startingBid: number;
  reservePrice: number | null;
  buyNowPrice: number | null;
  pickupCity: string | null;
  deliveryMethod: "SHIP" | "PICKUP" | "BOTH";
  startTime: Date | null;
  endTime: Date;
}

interface EditAuctionDrawerProps {
  auctionId: string;
  status: string;
  bidCount: number;
  initialData: EditAuctionInitialData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDurationLabel(startTime: Date, endTime: Date): string {
  const diffMs = endTime.getTime() - startTime.getTime();
  if (diffMs <= 0) return "—";
  const totalMinutes = Math.round(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? "dag" : "dagen"}`);
  if (hours > 0) parts.push(`${hours} uur`);
  if (days === 0 && minutes > 0) parts.push(`${minutes} min`);
  return parts.length > 0 ? parts.join(" en ") : "—";
}

export function EditAuctionDrawer({
  auctionId,
  status,
  bidCount,
  initialData,
  open,
  onOpenChange,
}: EditAuctionDrawerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const scope: EditScope = computeEditScope(status, bidCount);

  // Form-state
  const [title, setTitle] = useState(initialData.title);
  const [description, setDescription] = useState(initialData.description ?? "");
  const [startingBid, setStartingBid] = useState<string>(initialData.startingBid.toString());
  const [hasReserve, setHasReserve] = useState<boolean>(
    typeof initialData.reservePrice === "number" && initialData.reservePrice > 0,
  );
  const [reservePrice, setReservePrice] = useState<string>(
    initialData.reservePrice ? initialData.reservePrice.toString() : "",
  );
  const [hasBuyNow, setHasBuyNow] = useState<boolean>(
    typeof initialData.buyNowPrice === "number" && initialData.buyNowPrice > 0,
  );
  const [buyNowPrice, setBuyNowPrice] = useState<string>(
    initialData.buyNowPrice ? initialData.buyNowPrice.toString() : "",
  );
  const [pickupCity, setPickupCity] = useState(initialData.pickupCity ?? "");
  // Timing: in FULL scope mag seller endTime aanpassen. startTime blijft
  // gelocked (anders kan een seller met een bestaande SCHEDULED-veiling het
  // moment ineens naar morgen verschuiven — niet eerlijk t.o.v. watchers).
  const [endTimeInput, setEndTimeInput] = useState<string>(formatNLDateTimeLocal(initialData.endTime));

  // Photos: 3 staten — bestaande lock-images (DESCRIPTION_ONLY) of editable list.
  const existingImages = parseImageUrls(initialData.imageUrls);
  const [appendImages, setAppendImages] = useState<string[]>([]); // alleen DESCRIPTION_ONLY
  const [editableImages, setEditableImages] = useState<string[]>(existingImages); // TIMING_LOCKED + FULL

  // Reset state wanneer drawer opnieuw opent met andere veiling
  useEffect(() => {
    if (!open) return;
    setError(null);
    setTitle(initialData.title);
    setDescription(initialData.description ?? "");
    setStartingBid(initialData.startingBid.toString());
    setHasReserve(typeof initialData.reservePrice === "number" && initialData.reservePrice > 0);
    setReservePrice(initialData.reservePrice ? initialData.reservePrice.toString() : "");
    setHasBuyNow(typeof initialData.buyNowPrice === "number" && initialData.buyNowPrice > 0);
    setBuyNowPrice(initialData.buyNowPrice ? initialData.buyNowPrice.toString() : "");
    setPickupCity(initialData.pickupCity ?? "");
    setEndTimeInput(formatNLDateTimeLocal(initialData.endTime));
    setAppendImages([]);
    setEditableImages(existingImages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, auctionId]);

  // Escape om te sluiten + body-scroll-lock
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  const banner =
    scope === "FULL"
      ? "Veiling is nog niet gestart en heeft geen biedingen — alles is aanpasbaar."
      : scope === "TIMING_LOCKED"
      ? "Veiling is gestart. Tijdvenster is vergrendeld, andere velden zijn vrij aanpasbaar."
      : scope === "DESCRIPTION_ONLY"
      ? "Er is al een bod uitgebracht — alleen aanvullingen zijn mogelijk (beschrijving, extra foto's)."
      : "Deze veiling kan niet meer aangepast worden.";

  const headerTitle =
    scope === "FULL"
      ? "Veiling aanpassen"
      : scope === "TIMING_LOCKED"
      ? "Veiling aanpassen — gestart"
      : scope === "DESCRIPTION_ONLY"
      ? "Veiling aanpassen — biedingen aanwezig"
      : "Veiling vergrendeld";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (scope === "NONE") return;
    setError(null);

    const form = new FormData();
    if (description !== (initialData.description ?? "")) {
      form.set("description", description);
    }

    if (scope === "DESCRIPTION_ONLY") {
      if (appendImages.length > 0) {
        form.set("appendImageUrls", JSON.stringify(appendImages));
      }
    } else {
      // TIMING_LOCKED + FULL
      if (title !== initialData.title) form.set("title", title);
      // Images: compute diff. Als de seller alleen heeft toegevoegd → append-pad.
      // Anders → full replace.
      const removed = existingImages.filter((u) => !editableImages.includes(u));
      const added = editableImages.filter((u) => !existingImages.includes(u));
      if (removed.length === 0 && added.length > 0) {
        form.set("appendImageUrls", JSON.stringify(added));
      } else if (removed.length > 0 || added.length > 0) {
        form.set("imageUrls", JSON.stringify(editableImages));
      }
      const parsedStarting = parseFloat(startingBid);
      if (!Number.isNaN(parsedStarting) && parsedStarting !== initialData.startingBid) {
        form.set("startingBid", parsedStarting.toString());
      }
      // Reserve: toggle bepaalt of het meegestuurd wordt. Uit-toggle → 0 (server
      //          clearet naar null). Aan-toggle → parsed input.
      const parsedReserve = hasReserve && reservePrice ? parseFloat(reservePrice) : 0;
      if ((initialData.reservePrice ?? 0) !== parsedReserve) {
        form.set("reservePrice", parsedReserve.toString());
      }
      const parsedBuyNow = hasBuyNow && buyNowPrice ? parseFloat(buyNowPrice) : 0;
      if ((initialData.buyNowPrice ?? 0) !== parsedBuyNow) {
        form.set("buyNowPrice", parsedBuyNow.toString());
      }
      if (initialData.deliveryMethod !== "SHIP" && pickupCity !== (initialData.pickupCity ?? "")) {
        form.set("pickupCity", pickupCity);
      }

      if (scope === "FULL") {
        // Alleen endTime is muteerbaar — startTime locked zodat watchers
        // niet ineens een verschoven start zien. Server valideert ≤ start+14d
        // en > now.
        const newEnd = parseNLDateTimeLocal(endTimeInput);
        if (!Number.isNaN(newEnd.getTime()) && newEnd.getTime() !== initialData.endTime.getTime()) {
          form.set("endTime", newEnd.toISOString());
        }
      }
    }

    if ([...form.entries()].length === 0) {
      onOpenChange(false);
      return;
    }

    startTransition(async () => {
      const result = await updateAuction(auctionId, form);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      toast.success("Veiling bijgewerkt");
      onOpenChange(false);
      router.refresh();
    });
  };

  const canEdit = scope !== "NONE";
  const allowFull = scope === "FULL";
  const allowReplace = scope === "FULL" || scope === "TIMING_LOCKED";

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-auction-title"
    >
      <button
        type="button"
        aria-label="Sluiten"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-card shadow-xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-5 py-3 backdrop-blur">
          <h2 id="edit-auction-title" className="text-base font-semibold text-foreground">
            {headerTitle}
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Sluiten"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-5 px-5 py-5">
          <div
            className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${
              scope === "NONE"
                ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200"
                : scope === "DESCRIPTION_ONLY"
                ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
                : "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-200"
            }`}
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{banner}</span>
          </div>

          {canEdit && (
            <form id="edit-auction-form" onSubmit={handleSubmit} className="space-y-5">
              {/* Title — alleen TIMING_LOCKED + FULL */}
              {allowReplace ? (
                <div>
                  <label htmlFor="auction-title" className="mb-1.5 block text-xs font-medium text-foreground">
                    Titel
                  </label>
                  <input
                    id="auction-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    minLength={3}
                    maxLength={100}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              ) : (
                <LockedField label="Titel" value={initialData.title} reason="Vergrendeld zolang er biedingen zijn" />
              )}

              {/* Description — alle non-NONE scopes */}
              <div>
                <label htmlFor="auction-description" className="mb-1.5 block text-xs font-medium text-foreground">
                  Beschrijving
                </label>
                <textarea
                  id="auction-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  maxLength={2000}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Beschrijf de veiling..."
                />
                <p className="mt-1 text-[10px] text-muted-foreground">{description.length}/2000</p>
              </div>

              {/* Photos */}
              {allowReplace ? (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-foreground">Foto&apos;s</label>
                  <ImageUploader images={editableImages} onChange={setEditableImages} maxImages={10} context="auction" />
                </div>
              ) : (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-foreground">Foto&apos;s</label>
                  <p className="mb-2 text-[11px] text-muted-foreground">
                    Bestaande foto&apos;s zijn vergrendeld zodra er biedingen zijn — je mag wel extra foto&apos;s toevoegen.
                  </p>
                  {existingImages.length > 0 && (
                    <div className="mb-3 grid grid-cols-4 gap-2">
                      {existingImages.map((url, i) => (
                        <div key={url} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                          <Image src={url} alt={`Foto ${i + 1}`} fill sizes="120px" className="object-cover" />
                          <div className="absolute right-1 top-1 rounded-md bg-card/80 p-0.5 text-muted-foreground" title="Vergrendeld">
                            <Lock className="h-3 w-3" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mb-1.5 text-[11px] font-medium text-foreground">Foto&apos;s toevoegen</p>
                  <ImageUploader images={appendImages} onChange={setAppendImages} maxImages={Math.max(0, 10 - existingImages.length)} context="auction" />
                </div>
              )}

              {/* Pricing — alleen TIMING_LOCKED + FULL */}
              {allowReplace ? (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="auction-starting-bid" className="mb-1.5 block text-xs font-medium text-foreground">
                      Startbod (€)
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">€</span>
                      <input
                        id="auction-starting-bid"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="5"
                        value={startingBid}
                        onChange={(e) => setStartingBid(e.target.value)}
                        className="w-48 rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  {/* Reserve — toggle + conditional input (zelfde patroon als aanmaakpagina) */}
                  <div className="rounded-xl border border-border bg-muted/30 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">Reserveprijs</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Verberg een minimumprijs. De veiling verkoopt alleen als de reserve gehaald wordt.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setHasReserve((v) => !v)}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${hasReserve ? "bg-primary" : "bg-muted"}`}
                        aria-pressed={hasReserve}
                      >
                        <span
                          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${hasReserve ? "translate-x-5" : ""}`}
                        />
                      </button>
                    </div>
                    {hasReserve && (
                      <div className="mt-3 border-t border-border/60 pt-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">€</span>
                          <input
                            id="auction-reserve"
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0.01"
                            value={reservePrice}
                            onChange={(e) => setReservePrice(e.target.value)}
                            className="w-48 rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Direct kopen — toggle + conditional input */}
                  <div className="rounded-xl border border-border bg-muted/30 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">Direct Kopen-prijs</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Vaste prijs waarvoor de veiling direct verkocht kan worden. Vervalt bij 75% van het startbod.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setHasBuyNow((v) => !v)}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${hasBuyNow ? "bg-primary" : "bg-muted"}`}
                        aria-pressed={hasBuyNow}
                      >
                        <span
                          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${hasBuyNow ? "translate-x-5" : ""}`}
                        />
                      </button>
                    </div>
                    {hasBuyNow && (
                      <div className="mt-3 border-t border-border/60 pt-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">€</span>
                          <input
                            id="auction-buy-now"
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0.01"
                            value={buyNowPrice}
                            onChange={(e) => setBuyNowPrice(e.target.value)}
                            className="w-48 rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <LockedField label="Startbod" value={`€${initialData.startingBid.toFixed(2).replace(".", ",")}`} reason="Vergrendeld" />
                  <LockedField
                    label="Reserve"
                    value={initialData.reservePrice ? `€${initialData.reservePrice.toFixed(2).replace(".", ",")}` : "Geen"}
                    reason="Vergrendeld"
                  />
                  <LockedField
                    label="Direct kopen"
                    value={initialData.buyNowPrice ? `€${initialData.buyNowPrice.toFixed(2).replace(".", ",")}` : "Geen"}
                    reason="Vergrendeld"
                  />
                </div>
              )}

              {/* Pickup city — alleen TIMING_LOCKED + FULL en alleen bij PICKUP/BOTH */}
              {allowReplace && initialData.deliveryMethod !== "SHIP" && (
                <div>
                  <label htmlFor="auction-pickup-city" className="mb-1.5 block text-xs font-medium text-foreground">
                    Ophaal-plaats
                  </label>
                  <input
                    id="auction-pickup-city"
                    type="text"
                    value={pickupCity}
                    onChange={(e) => setPickupCity(e.target.value)}
                    placeholder="Bijv. Utrecht"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}

              {/* Timing — alleen FULL. Startmoment locked, eindmoment muteerbaar. */}
              {allowFull ? (
                (() => {
                  const startMs = initialData.startTime?.getTime() ?? Date.now();
                  const minEnd = new Date(Math.max(startMs + 60 * 60 * 1000, Date.now() + 60 * 60 * 1000));
                  // Calendar-cap: exact 14 dagen vanaf starttijd. Server houdt
                  // < 15 dagen als hard limit aan.
                  const maxEnd = new Date(startMs + 14 * 24 * 60 * 60 * 1000);
                  const parsedEnd = parseNLDateTimeLocal(endTimeInput);
                  const previewEnd = !Number.isNaN(parsedEnd.getTime()) ? parsedEnd : initialData.endTime;
                  const durationLabel = initialData.startTime
                    ? formatDurationLabel(initialData.startTime, previewEnd)
                    : "—";
                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-foreground">
                            <span className="flex items-center gap-1">
                              Starttijd
                              <Lock className="h-3 w-3 text-muted-foreground" />
                            </span>
                          </label>
                          <div
                            className="w-full cursor-not-allowed rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
                            title="Starttijd is vastgelegd bij aanmaken. Annuleer en publiceer opnieuw als je 'm wilt verschuiven."
                          >
                            {initialData.startTime ? formatNLDateTime(initialData.startTime) : "—"}
                          </div>
                        </div>
                        <div>
                          <label htmlFor="auction-end-time" className="mb-1.5 block text-xs font-medium text-foreground">
                            Eindtijd
                          </label>
                          <input
                            id="auction-end-time"
                            type="datetime-local"
                            value={endTimeInput}
                            min={formatNLDateTimeLocal(minEnd)}
                            max={formatNLDateTimeLocal(maxEnd)}
                            onChange={(e) => setEndTimeInput(e.target.value)}
                            step={60}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Looptijd: <span className="font-medium text-foreground">{durationLabel}</span>
                        <span className="mx-1.5 text-border">·</span>
                        Maximaal 14 dagen vanaf de starttijd.
                      </p>
                    </div>
                  );
                })()
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <LockedField
                    label="Starttijd"
                    value={initialData.startTime ? formatNLDateTime(initialData.startTime) : "—"}
                    reason="Veiling is al gestart"
                  />
                  <LockedField
                    label="Eindtijd"
                    value={formatNLDateTime(initialData.endTime)}
                    reason="Veiling is al gestart"
                  />
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </form>
          )}
        </div>

        {canEdit && (
          <footer className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-border bg-card/95 px-5 py-3 backdrop-blur">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={pending}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
            >
              Annuleren
            </button>
            <button
              type="submit"
              form="edit-auction-form"
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {pending ? "Opslaan…" : "Opslaan"}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

function LockedField({ label, value, reason }: { label: string; value: string; reason: string }) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {label}
        <Lock className="h-3 w-3" />
      </label>
      <div
        className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
        title={reason}
      >
        {value || "—"}
      </div>
    </div>
  );
}
