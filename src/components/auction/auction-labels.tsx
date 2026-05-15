import { COLOR_CLASSES, isValidLabelColor, type LabelType } from "@/lib/auction/labels";

// Render-component voor AuctionLabel-rijen op auction-cards en detail-pages.
// Server-component (geen client interactiviteit). Buyer-render: leest gewoon
// label.type/colorKey + auction.buyNowPrice voor het DIRECT_KOPEN-bedrag.

export interface AuctionLabelData {
  type: string;
  colorKey: string;
}

interface AuctionLabelsProps {
  labels: AuctionLabelData[] | undefined | null;
  /** Voor DIRECT_KOPEN-label hebben we het buyNowPrice nodig om "Direct Kopen €X" te tonen. */
  buyNowPrice?: number | null;
  size?: "sm" | "md";
  className?: string;
}

const LABEL_TEXT: Record<LabelType, string> = {
  GEEN_RESERVE: "Geen Reserve",
  DIRECT_KOPEN: "Direct Kopen",
  MOET_NU_WEG: "Moet nu weg!",
  HOT_ITEM: "Hot Item",
  TOPSTAAT: "Topstaat",
  ZELDZAAM: "Zeldzaam",
  HOLO_FOIL: "Holo / Foil",
  SNEL_VERZONDEN: "Snel verzonden",
  COMPLETE_SET: "Complete set",
};

function formatPrice(amount: number): string {
  return Number.isInteger(amount)
    ? `€${amount}`
    : `€${amount.toFixed(2).replace(".", ",")}`;
}

export function AuctionLabels({ labels, buyNowPrice, size = "sm", className = "" }: AuctionLabelsProps) {
  if (!labels || labels.length === 0) return null;

  const sizeClasses =
    size === "md"
      ? "px-3 py-1 text-xs"
      : "px-2 py-0.5 text-[10px]";

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {labels.map((l, i) => {
        const colorKey = isValidLabelColor(l.colorKey) ? l.colorKey : "slate";
        const colorClass = COLOR_CLASSES[colorKey];
        let text: string = LABEL_TEXT[l.type as LabelType] ?? l.type;
        if (l.type === "DIRECT_KOPEN" && typeof buyNowPrice === "number" && buyNowPrice > 0) {
          text = `Direct Kopen ${formatPrice(buyNowPrice)}`;
        }
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
