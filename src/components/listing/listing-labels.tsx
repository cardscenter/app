import { COLOR_CLASSES, LABEL_TEXT_NL, isValidLabelColor, type LabelType } from "@/lib/listing/labels";

// Render-component voor ListingLabel-rijen op listing-cards/list-rows/detail.
// Server-component (geen client-state). Spiegel van auction-labels — bewust
// dezelfde visuele tokens zodat labels site-breed consistent zijn.

export interface ListingLabelData {
  type: string;
  colorKey: string;
}

interface ListingLabelsProps {
  labels: ListingLabelData[] | undefined | null;
  size?: "sm" | "md";
  className?: string;
}

export function ListingLabels({ labels, size = "sm", className = "" }: ListingLabelsProps) {
  if (!labels || labels.length === 0) return null;

  const sizeClasses =
    size === "md" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[10px]";

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {labels.map((l, i) => {
        const colorKey = isValidLabelColor(l.colorKey) ? l.colorKey : "slate";
        const colorClass = COLOR_CLASSES[colorKey];
        const text = LABEL_TEXT_NL[l.type as LabelType] ?? l.type;
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
