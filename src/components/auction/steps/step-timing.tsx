"use client";

import { useTranslations } from "next-intl";
import { Calendar, Clock, Sparkles } from "lucide-react";
import {
  deriveAuctionWindow,
  formatNLDateTime,
  isSweetSpot,
  MAX_SCHEDULE_DAYS_AHEAD,
  SCHEDULED_THRESHOLD_MS,
} from "@/lib/auction/timing";

interface StepTimingProps {
  startDate: Date;
  duration: number;
  endTimeOfDay: string;
  onChange: (field: string, value: unknown) => void;
}

const DURATIONS = [3, 5, 7, 14];

function toDateInputValue(date: Date): string {
  // Format als yyyy-mm-dd in UTC (de form-state houdt midnight-UTC voor de
  // gekozen NL-kalenderdag).
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromDateInputValue(value: string): Date {
  // "yyyy-mm-dd" → midnight UTC voor die dag.
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}

export function StepTiming({ startDate, duration, endTimeOfDay, onChange }: StepTimingProps) {
  const t = useTranslations("auction");

  // Min/max voor date-input — vandaag t/m vandaag + 5d in NL-kalender.
  // Voor de input gebruiken we de UTC-getters omdat we Date als
  // calendar-day-in-NL representeren.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const maxDate = new Date(today.getTime() + MAX_SCHEDULE_DAYS_AHEAD * 24 * 60 * 60 * 1000);

  const window = deriveAuctionWindow({ startDate, duration, endTimeOfDay });
  const isInstant = window.startTime.getTime() <= Date.now() + SCHEDULED_THRESHOLD_MS;
  const sweetSpot = isSweetSpot(endTimeOfDay);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">{t("stepTiming")}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t("timingIntro")}</p>

      {/* Startdatum */}
      <div>
        <label htmlFor="startDate" className="block text-sm font-medium text-foreground">
          {t("startDateLabel")}
        </label>
        <input
          id="startDate"
          type="date"
          min={toDateInputValue(today)}
          max={toDateInputValue(maxDate)}
          value={toDateInputValue(startDate)}
          onChange={(e) => {
            if (e.target.value) onChange("startDate", fromDateInputValue(e.target.value));
          }}
          className="mt-1 block w-56 glass-input px-3 py-2.5 text-foreground"
        />
        <p className="mt-1 text-xs text-muted-foreground">{t("startDateHelp")}</p>
      </div>

      {/* Looptijd */}
      <div>
        <label className="block text-sm font-medium text-foreground">{t("duration")}</label>
        <div className="mt-2 flex flex-wrap gap-3">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onChange("duration", d)}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-all ${
                duration === d
                  ? "border-primary bg-primary text-white shadow-md"
                  : "glass-subtle text-foreground hover:bg-muted"
              }`}
            >
              <Clock className="h-4 w-4" />
              {d} {t("days")}
            </button>
          ))}
        </div>
      </div>

      {/* Eindtijd */}
      <div>
        <label htmlFor="endTimeOfDay" className="block text-sm font-medium text-foreground">
          {t("endTimeLabel")}
          <span className="ml-2 text-xs font-normal text-muted-foreground">{t("nlTimeBadge")}</span>
        </label>
        <input
          id="endTimeOfDay"
          type="time"
          value={endTimeOfDay}
          onChange={(e) => onChange("endTimeOfDay", e.target.value)}
          step={60}
          className="mt-1 block w-32 glass-input px-3 py-2.5 text-foreground"
        />

        {/* Sweet-spot-hint */}
        <div
          className={`mt-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
            sweetSpot
              ? "border-primary bg-primary/5 text-foreground"
              : "border-border bg-muted/40 text-muted-foreground"
          }`}
        >
          <div className="flex items-start gap-2">
            <Sparkles className={`mt-0.5 h-4 w-4 shrink-0 ${sweetSpot ? "text-primary" : "text-muted-foreground"}`} />
            <span>{t("sweetSpotHint")}</span>
          </div>
        </div>
      </div>

      {/* Live-preview */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-card">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{t("timingPreviewTitle")}</p>
        <p className="mt-1 text-sm font-medium text-foreground">
          {isInstant
            ? t("instantStartHint", { endDate: formatNLDateTime(window.endTime) })
            : t("startsOnPreview", { date: formatNLDateTime(window.startTime) })}
        </p>
        {!isInstant && (
          <p className="mt-1 text-sm text-muted-foreground">
            {t("endsOnPreview", { date: formatNLDateTime(window.endTime) })}
          </p>
        )}
      </div>
    </div>
  );
}
