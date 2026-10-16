import { Award } from "lucide-react";
import { eventColorClasses } from "@/lib/shop-events/config";

/** Badge-pill (poorten van Hulst) in de kleur van de badge. */
export function LeagueBadgePill({ name, color, description, size = "md" }: { name: string; color: string; description?: string | null; size?: "sm" | "md" }) {
  const c = eventColorClasses(color);
  return (
    <span
      title={description ?? undefined}
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${c.pill} ${size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs"}`}
    >
      <Award className={size === "sm" ? "size-3" : "size-3.5"} />
      {name}
    </span>
  );
}
