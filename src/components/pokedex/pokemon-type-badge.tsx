// Pokémon-game type colors (canonical, used in main series games since Gen 6).
// Our TCG TypeIcon maps types into the simpler TCG palette (e.g. Bug → Grass,
// Ghost → Psychic), which is fine on card pages but loses information on the
// Pokédex page where users expect the real-game type labels.

const TYPE_COLORS: Record<string, string> = {
  normal: "bg-neutral-400 text-neutral-950",
  fighting: "bg-red-700 text-white",
  flying: "bg-indigo-300 text-indigo-950",
  poison: "bg-fuchsia-600 text-white",
  ground: "bg-yellow-600 text-white",
  rock: "bg-yellow-800 text-white",
  bug: "bg-lime-500 text-lime-950",
  ghost: "bg-purple-700 text-white",
  steel: "bg-slate-400 text-slate-950",
  fire: "bg-orange-500 text-white",
  water: "bg-blue-500 text-white",
  grass: "bg-green-500 text-white",
  electric: "bg-yellow-400 text-yellow-950",
  psychic: "bg-pink-500 text-white",
  ice: "bg-cyan-300 text-cyan-950",
  dragon: "bg-indigo-700 text-white",
  dark: "bg-neutral-800 text-white",
  fairy: "bg-pink-300 text-pink-950",
};

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface Props {
  type: string; // lowercase PokéAPI name, e.g. "electric"
  size?: "sm" | "md";
}

export function PokemonTypeBadge({ type, size = "md" }: Props) {
  const color = TYPE_COLORS[type.toLowerCase()] ?? "bg-muted text-muted-foreground";
  const sizeClass = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";
  return (
    <span className={`inline-block rounded-full font-semibold ${sizeClass} ${color}`}>
      {titleCase(type)}
    </span>
  );
}
