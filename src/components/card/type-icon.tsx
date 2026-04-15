import Image from "next/image";
import { cn } from "@/lib/utils";

// TCGdex type names → icon filename. Colorless uses the Normal icon
// (standard Pokémon-game convention).
const ICON_MAP: Record<string, string> = {
  Grass: "Grass",
  Fire: "Fire",
  Water: "Water",
  Lightning: "Lightning",
  Psychic: "Psychic",
  Fighting: "Fighting",
  Darkness: "Darkness",
  Metal: "Metal",
  Dragon: "Dragon",
  Normal: "Normal",
  Colorless: "Normal",
  Fairy: "Fairy",
};

interface Props {
  type: string;
  size?: number;
  className?: string;
  showLabel?: boolean;
}

export function TypeIcon({ type, size = 32, className, showLabel }: Props) {
  const iconName = ICON_MAP[type];
  if (!iconName) {
    return <span className={cn("text-xs text-muted-foreground", className)}>{type}</span>;
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title={type}>
      <span
        className="relative inline-block shrink-0 overflow-hidden rounded-full ring-1 ring-border/60"
        style={{ width: size, height: size }}
      >
        <Image
          src={`/images/sets/types/${iconName}.png`}
          alt={type}
          width={size}
          height={size}
          className="size-full object-cover"
          unoptimized
        />
      </span>
      {showLabel && <span className="text-xs">{type}</span>}
    </span>
  );
}

export function TypeIconList({
  types,
  size = 32,
  className,
}: {
  types: string[];
  size?: number;
  className?: string;
}) {
  if (types.length === 0) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {types.map((t) => (
        <TypeIcon key={t} type={t} size={size} />
      ))}
    </span>
  );
}
