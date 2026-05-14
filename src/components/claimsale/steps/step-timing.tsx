"use client";

import { useTranslations } from "next-intl";
import { Calendar, Clock } from "lucide-react";
import {
  deriveClaimsaleStartTime,
  isClaimsaleScheduled,
  formatNLDateTime,
  MAX_SCHEDULE_DAYS_AHEAD,
} from "@/lib/claimsale/timing";

interface StepTimingProps {
  startDate: Date;
  startTimeOfDay: string;
  onChange: (field: string, value: unknown) => void;
}

function toDateInputValue(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromDateInputValue(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}

export function StepTiming({ startDate, startTimeOfDay, onChange }: StepTimingProps) {
  const t = useTranslations("claimsale");

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const maxDate = new Date(today.getTime() + MAX_SCHEDULE_DAYS_AHEAD * 24 * 60 * 60 * 1000);

  const startTime = deriveClaimsaleStartTime(startDate, startTimeOfDay);
  const scheduled = isClaimsaleScheduled(startTime);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">{t("stepTiming")}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t("timingIntro")}</p>

      <div className="flex flex-wrap gap-4">
        <div>
          <label htmlFor="cs-startDate" className="block text-sm font-medium text-foreground">
            {t("startDateLabel")}
          </label>
          <input
            id="cs-startDate"
            type="date"
            min={toDateInputValue(today)}
            max={toDateInputValue(maxDate)}
            value={toDateInputValue(startDate)}
            onChange={(e) => {
              if (e.target.value) onChange("startDate", fromDateInputValue(e.target.value));
            }}
            className="mt-1 block w-56 glass-input px-3 py-2.5 text-foreground"
          />
        </div>
        <div>
          <label htmlFor="cs-startTime" className="block text-sm font-medium text-foreground">
            {t("startTimeLabel")}
            <span className="ml-2 text-xs font-normal text-muted-foreground">{t("nlTimeBadge")}</span>
          </label>
          <input
            id="cs-startTime"
            type="time"
            step={60}
            value={startTimeOfDay}
            onChange={(e) => onChange("startTimeOfDay", e.target.value)}
            className="mt-1 block w-32 glass-input px-3 py-2.5 text-foreground"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("startDateHelp")}</p>

      <div
        className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
          scheduled
            ? "border-amber-300 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/20"
            : "border-emerald-300 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/20"
        }`}
      >
        <Clock
          className={`mt-0.5 h-4 w-4 shrink-0 ${
            scheduled
              ? "text-amber-600 dark:text-amber-400"
              : "text-emerald-600 dark:text-emerald-400"
          }`}
        />
        <p
          className={
            scheduled
              ? "text-amber-800 dark:text-amber-300"
              : "text-emerald-800 dark:text-emerald-300"
          }
        >
          {scheduled
            ? t("scheduledStartHint", { date: formatNLDateTime(startTime) })
            : t("instantStartHint")}
        </p>
      </div>
    </div>
  );
}
