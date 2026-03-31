"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { History } from "lucide-react";

type UsernameHistoryEntry = {
  oldName: string;
  changedAt: Date | string;
};

export function UsernameHistoryTooltip({
  displayName,
  history,
  className = "",
}: {
  displayName: string;
  history: UsernameHistoryEntry[];
  className?: string;
}) {
  const t = useTranslations("profile");
  const [showTooltip, setShowTooltip] = useState(false);

  if (history.length === 0) {
    return <span className={className}>{displayName}</span>;
  }

  return (
    <span
      className={`relative inline-flex items-center gap-1 ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {displayName}
      <History className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />

      {showTooltip && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-56 rounded-lg border border-border bg-popover p-3 shadow-lg">
          <p className="text-xs font-medium text-muted-foreground mb-1.5">
            {t("previousNames")}
          </p>
          <ul className="space-y-1">
            {history.map((entry, i) => (
              <li key={i} className="flex items-center justify-between text-xs">
                <span className="text-foreground">{entry.oldName}</span>
                <span className="text-muted-foreground/60">
                  {new Date(entry.changedAt).toLocaleDateString("nl-NL", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </span>
  );
}
