import { useTranslations } from "next-intl";
import { AlertOctagon } from "lucide-react";
import { Callout } from "@/components/dashboard/ui/callout";

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
    <Callout
      tone="pink"
      icon={AlertOctagon}
      className="mb-6"
      title={type === "PERMANENT" ? t("titlePermanent") : t("titleTemporary")}
    >
      <div className="space-y-1">
        {type === "TEMPORARY" && untilFormatted && <p>{t("until", { date: untilFormatted })}</p>}
        {reason && (
          <p>
            <span className="font-medium">{t("reasonLabel")}:</span> {reason}
          </p>
        )}
        <p className="text-xs opacity-80">{t("allowedActions")}</p>
      </div>
    </Callout>
  );
}
