import { getRarity } from "@/lib/cosmetic-config";
import { cn } from "@/lib/utils";

interface RarityBadgeProps {
  rarity: string;
  className?: string;
}

export function RarityBadge({ rarity, className }: RarityBadgeProps) {
  const r = getRarity(rarity);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border",
        r.textColor,
        r.bgColor,
        r.borderColor,
        className
      )}
    >
      {r.label}
    </span>
  );
}
