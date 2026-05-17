"use client";

import { useTranslations } from "next-intl";
import { Calendar, Clock, Zap } from "lucide-react";
import {
  deriveClaimsaleStartTime,
  isClaimsaleScheduled,
  formatNLDateTime,
  MAX_SCHEDULE_DAYS_AHEAD,
} from "@/lib/claimsale/timing";
import {
  formatNLDateTimeLocal,
  parseNLDateTimeLocal,
} from "@/lib/auction/timing";

interface StepTimingProps {
  startDate: Date;
  startTimeOfDay: string;
  onChange: (field: string, value: unknown) => void;
}

function todayUTCMidnight(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function tomorrowUTCMidnight(): Date {
  const d = todayUTCMidnight();
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export function StepTiming({ startDate, startTimeOfDay, onChange }: StepTimingProps) {
  const t = useTranslations("claimsale");

  // Mode wordt afgeleid uit de huidige form-state. "instant" = startTime nu of
  // in het verleden → server publisht direct. "scheduled" = startTime in de
  // toekomst voorbij de SCHEDULED_THRESHOLD. Geen aparte state-vlag nodig —
  // de toggle wijzigt de form-velden zodat de afgeleide mode mee flipt.
  const startTime = deriveClaimsaleStartTime(startDate, startTimeOfDay);
  const mode: "instant" | "scheduled" = isClaimsaleScheduled(startTime) ? "scheduled" : "instant";

  function selectInstant() {
    // Reset naar today midnight + 00:00 zodat de afgeleide startTime gegarandeerd
    // in het verleden valt en de server het instant-publish-pad pakt.
    onChange("startDate", todayUTCMidnight());
    onChange("startTimeOfDay", "00:00");
  }

  function selectScheduled() {
    // Al in scheduled-mode? Behoud de huidige picker-waarde zodat seller niet
    // z'n keuze verliest bij een dubbele klik op de toggle.
    if (mode === "scheduled") return;
    onChange("startDate", tomorrowUTCMidnight());
    onChange("startTimeOfDay", "09:00");
  }

  // Picker-grenzen — nu t/m nu + 5 dagen (NL-tijd, DST-correct via helpers).
  const now = new Date();
  const maxStart = new Date(now.getTime() + MAX_SCHEDULE_DAYS_AHEAD * 24 * 60 * 60 * 1000);

  function handleStartChange(value: string) {
    if (!value) return;
    const newStart = parseNLDateTimeLocal(value);
    if (Number.isNaN(newStart.getTime())) return;
    // Split terug naar form-state-shape: NL-kalenderdag als UTC-midnight Date
    // + HH:MM-string. Robuust via formatNLDateTimeLocal-roundtrip (geen
    // browser-tijd-leakage).
    const [datePart, timePart] = formatNLDateTimeLocal(newStart).split("T");
    const [y, m, d] = datePart.split("-").map(Number);
    const calendarDay = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    onChange("startDate", calendarDay);
    onChange("startTimeOfDay", timePart || "09:00");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">{t("stepTiming")}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t("timingIntro")}</p>

      {/* Mode-selector: twee cards, klikbaar als radio. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={selectInstant}
          aria-pressed={mode === "instant"}
          className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
            mode === "instant"
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-border bg-card hover:border-primary/40 hover:bg-muted"
          }`}
        >
          <Zap
            className={`mt-0.5 h-5 w-5 shrink-0 ${
              mode === "instant" ? "text-primary" : "text-muted-foreground"
            }`}
          />
          <div>
            <p className="text-sm font-semibold text-foreground">Claimsale gaat direct live</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Zodra je publiceert kunnen kopers items claimen.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={selectScheduled}
          aria-pressed={mode === "scheduled"}
          className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
            mode === "scheduled"
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-border bg-card hover:border-primary/40 hover:bg-muted"
          }`}
        >
          <Calendar
            className={`mt-0.5 h-5 w-5 shrink-0 ${
              mode === "scheduled" ? "text-primary" : "text-muted-foreground"
            }`}
          />
          <div>
            <p className="text-sm font-semibold text-foreground">Claimsale inplannen</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Plan een startmoment tot {MAX_SCHEDULE_DAYS_AHEAD} dagen vooruit.
            </p>
          </div>
        </button>
      </div>

      {/* Picker — alleen in scheduled-mode. */}
      {mode === "scheduled" && (
        <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
          <div>
            <label htmlFor="cs-startTime" className="block text-sm font-medium text-foreground">
              {t("startDateLabel")}
            </label>
            <input
              id="cs-startTime"
              type="datetime-local"
              min={formatNLDateTimeLocal(now)}
              max={formatNLDateTimeLocal(maxStart)}
              value={formatNLDateTimeLocal(startTime)}
              onChange={(e) => handleStartChange(e.target.value)}
              step={60}
              className="mt-1 block w-64 glass-input px-3 py-2.5 text-foreground"
            />
            <p className="mt-1 text-xs text-muted-foreground">{t("startDateHelp")}</p>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800/50 dark:bg-amber-950/20">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-amber-800 dark:text-amber-300">
              {t("scheduledStartHint", { date: formatNLDateTime(startTime) })}
            </p>
          </div>
        </div>
      )}

      {/* Instant-bevestiging — kleine groene reassurance. */}
      {mode === "instant" && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm dark:border-emerald-800/50 dark:bg-emerald-950/20">
          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-emerald-800 dark:text-emerald-300">{t("instantStartHint")}</p>
        </div>
      )}
    </div>
  );
}
