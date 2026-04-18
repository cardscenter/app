import { getTranslations } from "next-intl/server";
import type { PokemonStat } from "@/lib/pokeapi/client";

// Map PokéAPI stat names to i18n keys. Labels themselves come from next-intl.
const STAT_I18N_KEYS: Record<string, string> = {
  hp: "statHp",
  attack: "statAttack",
  defense: "statDefense",
  "special-attack": "statSpecialAttack",
  "special-defense": "statSpecialDefense",
  speed: "statSpeed",
};

// Stat-specific accent colors (loosely based on main-series UI).
const STAT_COLORS: Record<string, string> = {
  hp: "bg-emerald-500",
  attack: "bg-orange-500",
  defense: "bg-yellow-500",
  "special-attack": "bg-blue-500",
  "special-defense": "bg-teal-500",
  speed: "bg-pink-500",
};

// Max base stat visible on the bar. 255 is the theoretical max (Blissful
// HP = 255), so we cap bars at that. Most stats land well below.
const MAX_STAT = 200;

interface Props {
  stats: PokemonStat[];
}

export async function PokedexStats({ stats }: Props) {
  const t = await getTranslations("pokedex");
  // PokéAPI returns stats in a fixed order (hp, attack, defense, sp-atk,
  // sp-def, speed), but we sort deterministically just in case.
  const order = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"];
  const sorted = [...stats].sort(
    (a, b) => order.indexOf(a.stat.name) - order.indexOf(b.stat.name)
  );
  const total = sorted.reduce((sum, s) => sum + s.base_stat, 0);

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-4 text-lg font-bold text-foreground">{t("baseStats")}</h2>
      <div className="space-y-2">
        {sorted.map((s) => {
          const i18nKey = STAT_I18N_KEYS[s.stat.name];
          const label = i18nKey ? t(i18nKey) : s.stat.name;
          const color = STAT_COLORS[s.stat.name] ?? "bg-primary";
          const width = Math.min(100, (s.base_stat / MAX_STAT) * 100);
          return (
            <div key={s.stat.name} className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-sm text-muted-foreground">{label}</span>
              <span className="w-10 shrink-0 text-right font-mono text-sm font-semibold text-foreground">
                {s.base_stat}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${color} transition-[width]`}
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 border-t border-border pt-3 text-sm">
        <span className="text-muted-foreground">{t("total")}:</span>{" "}
        <span className="font-bold text-foreground">{total}</span>
      </div>
    </section>
  );
}
