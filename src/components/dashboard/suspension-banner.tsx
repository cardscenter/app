import { useTranslations } from "next-intl";
import { AlertOctagon } from "lucide-react";

interface SuspensionBannerProps {
  type: string;
  until: string | null;
  reason: string | null;
}

export function SuspensionBanner({ type, until, reason }: SuspensionBannerProps) {
  const t = useTranslations("suspension");

  const untilFormatted = until
    ? new Date(until).toLocaleDateString("nl-NL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="mb-6 rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/40">
      <div className="flex items-start gap-3">
        <AlertOctagon className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">
            {type === "PERMANENT" ? t("titlePermanent") : t("titleTemporary")}
          </p>
          {type === "TEMPORARY" && untilFormatted && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {t("until", { date: untilFormatted })}
            </p>
          )}
          {reason && (
            <p className="text-sm text-red-600 dark:text-red-400">
              <span className="font-medium">{t("reasonLabel")}:</span> {reason}
            </p>
          )}
          <p className="text-xs text-red-600/80 dark:text-red-400/80">{t("allowedActions")}</p>
        </div>
      </div>
    </div>
  );
}
