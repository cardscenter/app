import { TypeIcon } from "./type-icon";
import { Link } from "@/i18n/navigation";
import { Shield, ShieldCheck, ArrowRight, Zap, BookOpen } from "lucide-react";
import type {
  TCGdexAttack,
  TCGdexAbility,
  TCGdexWeakness,
} from "@/lib/tcgdex/types";

interface Props {
  category?: string; // "Pokemon" | "Trainer" | "Energy"
  stage?: string | null;
  evolveFrom?: string | null;
  dexId?: number[] | null;
  attacks?: TCGdexAttack[] | null;
  abilities?: TCGdexAbility[] | null;
  weaknesses?: TCGdexWeakness[] | null;
  resistances?: TCGdexWeakness[] | null;
  retreat?: number | null;
  trainerType?: string | null;
  energyType?: string | null;
  effect?: string | null;
  pokedexHref?: string | null; // Link to the Pokédex entry for this Pokémon
}

function formatStage(stage: string | null | undefined): string | null {
  if (!stage) return null;
  if (stage === "Stage1") return "Stage 1";
  if (stage === "Stage2") return "Stage 2";
  return stage;
}

export function CardGameplayBlock({
  category,
  stage,
  evolveFrom,
  dexId,
  attacks,
  abilities,
  weaknesses,
  resistances,
  retreat,
  trainerType,
  energyType,
  effect,
  pokedexHref,
}: Props) {
  const isPokemon = category === "Pokemon";
  const stageLabel = formatStage(stage);

  return (
    <div className="space-y-4">
      {/* Evolution + dex + stage */}
      {isPokemon && (stageLabel || evolveFrom || (dexId && dexId.length > 0)) && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {stageLabel && (
            <span className="rounded-full bg-muted/60 px-3 py-1 text-xs font-semibold text-foreground">
              {stageLabel}
            </span>
          )}
          {evolveFrom && (
            <span className="inline-flex items-center gap-1.5 text-xs">
              <ArrowRight className="size-3.5" />
              Evolueert uit <strong className="text-foreground">{evolveFrom}</strong>
            </span>
          )}
          {dexId && dexId.length > 0 && (
            <span className="text-xs">
              Pokédex #{dexId.join(", #")}
            </span>
          )}
          {pokedexHref && (
            <Link
              href={pokedexHref}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              <BookOpen className="size-3.5" />
              Pokédex Entry Bekijken
            </Link>
          )}
        </div>
      )}

      {/* Trainer / Energy type + effect */}
      {(trainerType || energyType) && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {trainerType ? `Trainer · ${trainerType}` : `Energy · ${energyType}`}
          </p>
          {effect && (
            <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">{effect}</p>
          )}
        </div>
      )}

      {/* Abilities */}
      {abilities && abilities.length > 0 && (
        <div className="space-y-2">
          {abilities.map((ab, i) => (
            <div key={i} className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2">
                <Zap className="size-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {ab.type ?? "Ability"}
                </span>
                <span className="font-bold text-foreground">{ab.name}</span>
              </div>
              {ab.effect && (
                <p className="mt-1.5 text-sm text-foreground whitespace-pre-wrap">{ab.effect}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Attacks */}
      {attacks && attacks.length > 0 && (
        <div className="space-y-2">
          {attacks.map((atk, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-0.5">
                    {atk.cost?.map((c, j) => (
                      <TypeIcon key={j} type={c} size={22} />
                    ))}
                  </span>
                  <span className="font-bold text-foreground">{atk.name}</span>
                </div>
                {atk.damage !== undefined && atk.damage !== null && (
                  <span className="text-xl font-extrabold text-foreground">
                    {atk.damage}
                  </span>
                )}
              </div>
              {atk.effect && (
                <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{atk.effect}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Weakness / Resistance / Retreat row */}
      {isPokemon && (weaknesses?.length || resistances?.length || retreat !== undefined) && (
        <div className="grid grid-cols-3 gap-3">
          <StatBox
            icon={<Shield className="size-4 text-red-500" />}
            label="Zwakte"
            value={
              weaknesses && weaknesses.length > 0 ? (
                <div className="flex items-center gap-1">
                  {weaknesses.map((w, i) => (
                    <span key={i} className="inline-flex items-center gap-1">
                      <TypeIcon type={w.type} size={22} />
                      <span className="text-xs font-semibold">{w.value}</span>
                    </span>
                  ))}
                </div>
              ) : <span className="text-xs text-muted-foreground">—</span>
            }
          />
          <StatBox
            icon={<ShieldCheck className="size-4 text-emerald-500" />}
            label="Weerstand"
            value={
              resistances && resistances.length > 0 ? (
                <div className="flex items-center gap-1">
                  {resistances.map((w, i) => (
                    <span key={i} className="inline-flex items-center gap-1">
                      <TypeIcon type={w.type} size={22} />
                      <span className="text-xs font-semibold">{w.value}</span>
                    </span>
                  ))}
                </div>
              ) : <span className="text-xs text-muted-foreground">—</span>
            }
          />
          <StatBox
            icon={<ArrowRight className="size-4 text-muted-foreground" />}
            label="Retreat"
            value={
              retreat !== undefined && retreat !== null ? (
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: retreat }).map((_, i) => (
                    <TypeIcon key={i} type="Colorless" size={22} />
                  ))}
                  {retreat === 0 && <span className="text-xs text-muted-foreground">Gratis</span>}
                </div>
              ) : <span className="text-xs text-muted-foreground">—</span>
            }
          />
        </div>
      )}

    </div>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <div className="mt-1.5">{value}</div>
    </div>
  );
}
