import { COLOR_CLASSES, isValidLabelColor } from "@/lib/claimsale/labels";
import type { ClaimsaleLabelType } from "@/lib/claimsale/labels";

// Render-component voor ClaimsaleLabel-rijen op claimsale-cards en detail-pages.
// Server-component (geen client interactiviteit).

export interface ClaimsaleLabelData {
  type: string;
  colorKey: string;
}

interface ClaimsaleLabelsProps {
  labels: ClaimsaleLabelData[] | undefined | null;
  size?: "sm" | "md";
  className?: string;
}

const LABEL_TEXT: Record<ClaimsaleLabelType, string> = {
  MOET_NU_WEG: "Moet nu weg!",
  HOT_ITEM: "Hot Item",
  TOPSTAAT: "Topstaat",
  ZELDZAAM: "Zeldzaam",
  HOLO_FOIL: "Holo / Foil",
  SNEL_VERZONDEN: "Snel verzonden",
  NIEUW: "Nieuw",
  OPRUIMING: "Opruiming",
};

export function ClaimsaleLabels({ labels, size = "sm", className = "" }: ClaimsaleLabelsProps) {
  if (!labels || labels.length === 0) return null;

  const sizeClasses = size === "md" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[10px]";

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {labels.map((l, i) => {
        const colorKey = isValidLabelColor(l.colorKey) ? l.colorKey : "slate";
        const colorClass = COLOR_CLASSES[colorKey];
        const text = LABEL_TEXT[l.type as ClaimsaleLabelType] ?? l.type;
        return (
          <span
            key={`${l.type}-${i}`}
            className={`inline-flex items-center rounded-full font-semibold uppercase tracking-tight ${sizeClasses} ${colorClass}`}
          >
            {text}
          </span>
        );
      })}
    </div>
  );
}

export { LABEL_TEXT as CLAIMSALE_LABEL_TEXT_NL };
