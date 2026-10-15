import { eventColorClasses } from "@/lib/shop-events/config";

/** Klein label met de type-kleur (League-avond, Toernooi, ...). */
export function EventTypePill({ name, color, className = "" }: { name: string; color: string; className?: string }) {
  const c = eventColorClasses(color);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${c.pill} ${className}`}>
      <span aria-hidden className={`size-1.5 rounded-full ${c.dot}`} />
      {name}
    </span>
  );
}
