"use client";

import { useTranslations } from "next-intl";
import { Calendar, Clock, ThumbsUp, Info, AlertTriangle } from "lucide-react";
import {
  formatNLDateTime,
  formatNLDateTimeLocal,
  parseNLDateTimeLocal,
  rateAuctionEndTime,
  MAX_SCHEDULE_DAYS_AHEAD,
  MAX_AUCTION_DURATION_MS,
} from "@/lib/auction/timing";

interface StepTimingProps {
  startTime: Date;
  endTime: Date;
  onChange: (field: string, value: unknown) => void;
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
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "uur" : "uur"}`);
  if (days === 0 && minutes > 0) parts.push(`${minutes} min`);
  return parts.length > 0 ? parts.join(" en ") : "—";
}

export function StepTiming({ startTime, endTime, onChange }: StepTimingProps) {
  const t = useTranslations("auction");

  const now = new Date();
  const maxStart = new Date(now.getTime() + MAX_SCHEDULE_DAYS_AHEAD * 24 * 60 * 60 * 1000);
  // Calendar-cap: exact 14 dagen vanaf de starttijd zodat het laatste
  // selecteerbare moment "14 dagen om dezelfde tijd" is. Server hanteert
  // nog steeds < 15 dagen als hard limit.
  const maxEnd = new Date(startTime.getTime() + 14 * 24 * 60 * 60 * 1000);
  // Min voor endTime = max(startTime + 1u, now + 1u) — voorkomt eindtijden in
  // het verleden of trivial-flash-veilingen.
  const minEnd = new Date(Math.max(startTime.getTime() + 60 * 60 * 1000, now.getTime() + 60 * 60 * 1000));

  const rating = rateAuctionEndTime(endTime);
  const ratingClasses = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-200",
    sky: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800/50 dark:bg-sky-950/30 dark:text-sky-200",
    slate: "border-border bg-muted/40 text-foreground",
    amber: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200",
    rose: "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800/50 dark:bg-rose-950/30 dark:text-rose-200",
  }[rating.tone];
  const RatingIcon = rating.score >= 4 ? ThumbsUp : rating.score === 3 ? Info : AlertTriangle;

  const durationLabel = formatDurationLabel(startTime, endTime);
  const tooShort = endTime.getTime() - startTime.getTime() < 60 * 60 * 1000;
  const tooLong = endTime.getTime() - startTime.getTime() >= MAX_AUCTION_DURATION_MS;

  function handleStartChange(value: string) {
    if (!value) return;
    const newStart = parseNLDateTimeLocal(value);
    if (Number.isNaN(newStart.getTime())) return;
    onChange("startTime", newStart);
    // Als endTime nu binnen 1u na start of zelfs vóór start ligt, schuif 'm
    // naar start + huidige duration (of min 1u). Behoudt de gewenste lengte
    // van de seller als die al een goed eindmoment had ingesteld.
    const currentDuration = endTime.getTime() - startTime.getTime();
    const adjustedEnd = new Date(newStart.getTime() + Math.max(currentDuration, 60 * 60 * 1000));
    if (adjustedEnd.getTime() !== endTime.getTime()) {
      onChange("endTime", adjustedEnd);
    }
  }

  function handleEndChange(value: string) {
    if (!value) return;
    const newEnd = parseNLDateTimeLocal(value);
    if (Number.isNaN(newEnd.getTime())) return;
    onChange("endTime", newEnd);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">{t("stepTiming")}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t("timingIntro")}</p>

      {/* Starttijd */}
      <div>
        <label htmlFor="startTime" className="block text-sm font-medium text-foreground">
          Starttijd
        </label>
        <input
          id="startTime"
          type="datetime-local"
          min={formatNLDateTimeLocal(now)}
          max={formatNLDateTimeLocal(maxStart)}
          value={formatNLDateTimeLocal(startTime)}
          onChange={(e) => handleStartChange(e.target.value)}
          step={60}
          className="mt-1 block w-64 glass-input px-3 py-2.5 text-foreground"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Nu of tot {MAX_SCHEDULE_DAYS_AHEAD} dagen vooruit. Bij een starttijd binnen 5 minuten gaat de veiling direct live.
        </p>
      </div>

      {/* Eindtijd */}
      <div>
        <label htmlFor="endTime" className="block text-sm font-medium text-foreground">
          Eindtijd
        </label>
        <input
          id="endTime"
          type="datetime-local"
          min={formatNLDateTimeLocal(minEnd)}
          max={formatNLDateTimeLocal(maxEnd)}
          value={formatNLDateTimeLocal(endTime)}
          onChange={(e) => handleEndChange(e.target.value)}
          step={60}
          className="mt-1 block w-64 glass-input px-3 py-2.5 text-foreground"
        />
        <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Looptijd: <span className="font-medium text-foreground">{durationLabel}</span>
        </p>

        {tooShort && (
          <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
            De veiling moet minstens een uur duren.
          </div>
        )}
        {tooLong && (
          <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
            Een veiling mag niet 15 dagen of langer duren.
          </div>
        )}

        {/* Eindmoment-advies */}
        {!tooShort && !tooLong && (
          <div className={`mt-3 rounded-xl border px-4 py-3 text-sm transition-colors ${ratingClasses}`}>
            <div className="flex items-start gap-2.5">
              <RatingIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <span className="font-semibold">{rating.label}</span>
                <p className="text-xs opacity-90">
                  Eindigt op <span className="font-medium">{formatNLDateTime(endTime)}</span>.
                </p>
                {rating.recommendation && (
                  <p className="text-xs leading-relaxed">{rating.recommendation}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
