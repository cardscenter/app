"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { CalendarClock, Key, Check, X, AlertTriangle } from "lucide-react";
import {
  proposePickup,
  respondToPickup,
  confirmPickup,
  cancelExternalReservation,
} from "@/actions/pickup";
import { PICKUP_CODE_LENGTH, PICKUP_CODE_REGEX } from "@/lib/pickup-config";

// Input-sanitizer voor pickup-code: laat alleen 0-9 en toegestane hoofdletters
// (A-Z behalve I/O) door, upper-case automatisch, maximaal 5 tekens.
function sanitizePickupInput(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^0-9A-HJ-NP-Z]/g, "")
    .slice(0, PICKUP_CODE_LENGTH);
}

export interface PickupScheduleData {
  id: string;
  proposedById: string;
  proposedFor: string;
  windowStart: string;
  windowEnd: string;
  status: string;
  pickupCode: string | null; // alleen aanwezig voor de buyer
  pickupCodeAttempts: number;
  pickupLockedUntil: string | null;
}

interface Props {
  shippingBundleId: string;
  bundleStatus: string;
  paymentMode: string;
  schedule: PickupScheduleData | null;
  currentUserId: string;
  buyerId: string;
  sellerId: string;
}

// Pickup-flow UI ingebed in BundleOfferMessage. Toont: propose-knop +
// modal als er nog geen accepteerd ophaalmoment is, code-display voor
// buyer + confirm-form voor seller bij SCHEDULED, en cancel-knop voor
// EXTERNAL-bundles in PENDING/SCHEDULED.
export function PickupActions({
  shippingBundleId,
  bundleStatus,
  paymentMode,
  schedule,
  currentUserId,
  buyerId,
  sellerId,
}: Props) {
  const t = useTranslations("pickup");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showProposeForm, setShowProposeForm] = useState(false);
  const [code, setCode] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [windowStart, setWindowStart] = useState("10:00");
  const [windowEnd, setWindowEnd] = useState("12:00");

  const isBuyer = currentUserId === buyerId;
  const isSeller = currentUserId === sellerId;

  // Status-gebaseerde affordances
  const canPropose =
    (paymentMode === "EXTERNAL" && (bundleStatus === "PENDING" || bundleStatus === "SCHEDULED")) ||
    (paymentMode === "PLATFORM" && bundleStatus === "PAID");
  const canRespondToProposal =
    schedule?.status === "PROPOSED" && schedule.proposedById !== currentUserId;
  const canConfirmCode = isSeller && bundleStatus === "SCHEDULED" && schedule?.status === "ACCEPTED";
  const showBuyerCode = isBuyer && bundleStatus === "SCHEDULED" && schedule?.status === "ACCEPTED" && schedule?.pickupCode;
  const canCancelExternal = paymentMode === "EXTERNAL" && (bundleStatus === "PENDING" || bundleStatus === "SCHEDULED");

  function run(fn: () => Promise<{ error?: string; success?: boolean }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  function handleProposeSubmit() {
    if (!pickupDate) {
      setError(t("errors.invalidDate"));
      return;
    }
    setShowProposeForm(false);
    run(() =>
      proposePickup({
        shippingBundleId,
        proposedFor: pickupDate,
        windowStart,
        windowEnd,
      })
    );
  }

  function handleConfirmPickup() {
    if (!PICKUP_CODE_REGEX.test(code)) {
      setError(t("wrongCode"));
      return;
    }
    run(() => confirmPickup({ shippingBundleId, code }));
  }

  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Schedule informatie */}
      {schedule && (schedule.status === "ACCEPTED" || schedule.status === "PROPOSED") && (
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-2 text-xs text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
          <CalendarClock className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>
            {t("scheduledOn", {
              date: new Date(schedule.proposedFor).toLocaleDateString("nl-NL"),
              start: schedule.windowStart,
              end: schedule.windowEnd,
            })}
            {schedule.status === "PROPOSED" && " (in afwachting)"}
          </span>
        </div>
      )}

      {/* Propose-knop voor PROPOSE/RESCHEDULE */}
      {canPropose && (!schedule || schedule.status !== "PROPOSED" || schedule.proposedById === currentUserId) && (
        <button
          type="button"
          onClick={() => setShowProposeForm(true)}
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          <CalendarClock className="h-4 w-4" />
          {t("proposeMoment")}
        </button>
      )}

      {/* Accept/Reject voor andere partij bij PROPOSED */}
      {canRespondToProposal && schedule && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => run(() => respondToPickup(schedule.id, "ACCEPT"))}
            disabled={pending}
            className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {t("accept")}
          </button>
          <button
            type="button"
            onClick={() => run(() => respondToPickup(schedule.id, "REJECT"))}
            disabled={pending}
            className="flex-1 rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
          >
            {t("reject")}
          </button>
        </div>
      )}

      {/* Buyer-code-display */}
      {showBuyerCode && schedule && (
        <div className="rounded-lg border border-blue-300 bg-blue-50 p-3 dark:border-blue-700 dark:bg-blue-950/40">
          <div className="flex items-center gap-2 text-xs font-medium text-blue-800 dark:text-blue-200">
            <Key className="h-3.5 w-3.5" />
            {t("codeForBuyer")}
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tracking-widest text-blue-900 dark:text-blue-100">
            {schedule.pickupCode}
          </div>
        </div>
      )}

      {/* Seller-confirm-form */}
      {canConfirmCode && schedule && (
        <div className="space-y-2">
          {schedule.pickupLockedUntil && new Date(schedule.pickupLockedUntil) > new Date() ? (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t("tooManyAttempts")}
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={PICKUP_CODE_LENGTH}
                  value={code}
                  onChange={(e) => setCode(sanitizePickupInput(e.target.value))}
                  placeholder="0000A"
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-center font-mono text-lg tracking-widest uppercase text-foreground"
                />
                <button
                  type="button"
                  onClick={handleConfirmPickup}
                  disabled={pending || !PICKUP_CODE_REGEX.test(code)}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                </button>
              </div>
              {schedule.pickupCodeAttempts > 0 && (
                <p className="text-xs text-amber-600">
                  {schedule.pickupCodeAttempts} verkeerde poging(en)
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Cancel external reservation */}
      {canCancelExternal && (
        <button
          type="button"
          onClick={() => {
            if (confirm(t("confirmCancelReservation"))) {
              run(() => cancelExternalReservation(shippingBundleId));
            }
          }}
          disabled={pending}
          className="w-full rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30 disabled:opacity-50"
        >
          <X className="inline h-3.5 w-3.5 mr-1" />
          {t("cancelReservation")}
        </button>
      )}

      {/* Propose-form modal */}
      {showProposeForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowProposeForm(false)}>
          <div className="glass w-full max-w-sm rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">{t("proposeTitle")}</h3>
              <button onClick={() => setShowProposeForm(false)} className="rounded-lg p-1 text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">{t("dateLabel")}</label>
                <input
                  type="date"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">{t("windowStart")}</label>
                  <input
                    type="time"
                    value={windowStart}
                    onChange={(e) => setWindowStart(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">{t("windowEnd")}</label>
                  <input
                    type="time"
                    value={windowEnd}
                    onChange={(e) => setWindowEnd(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProposeForm(false)}
                  className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleProposeSubmit}
                  disabled={pending || !pickupDate}
                  className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  {t("submit")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
