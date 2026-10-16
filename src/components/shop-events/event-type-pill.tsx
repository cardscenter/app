import { Pill, type PastelColor } from "@/components/ploy/pill";

/** Type-kleur (blue/amber/emerald/violet/rose/slate) → pastel van de design-pass. */
export function typePastel(color: string | null | undefined): PastelColor {
  switch (color) {
    case "amber":
      return "yellow";
    case "emerald":
      return "green";
    case "violet":
    case "rose":
      return "pink";
    default:
      return "blue";
  }
}

/** Klein pastel-label met de type-naam (League-avond, Toernooi, ...). */
export function EventTypePill({ name, color, className = "" }: { name: string; color: string; className?: string }) {
  return (
    <Pill tone="pastel" color={typePastel(color)} className={className}>
      {name}
    </Pill>
  );
}
