import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { Pokemon, Species } from "@/lib/pokeapi/client";

interface Props {
  pokemon: Pokemon;
  species: Species;
  flavorText: string | null; // pre-picked for the current locale
}

// Height komt in decimeters, weight in hectogrammen.
function formatHeight(decimetres: number): string {
  return `${(decimetres / 10).toFixed(1)} m`;
}
function formatWeight(hectograms: number): string {
  return `${(hectograms / 10).toFixed(1)} kg`;
}

function titleCase(s: string): string {
  return s.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

const GENERATION_ROMAN: Record<string, string> = {
  "generation-i": "I",
  "generation-ii": "II",
  "generation-iii": "III",
  "generation-iv": "IV",
  "generation-v": "V",
  "generation-vi": "VI",
  "generation-vii": "VII",
  "generation-viii": "VIII",
  "generation-ix": "IX",
};

const GROWTH_RATE_NL: Record<string, string> = {
  slow: "Langzaam",
  medium: "Gemiddeld",
  fast: "Snel",
  "medium-slow": "Gemiddeld-langzaam",
  "slow-then-very-fast": "Erratic",
  "fast-then-very-slow": "Fluctuating",
};

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/40 px-3 py-2">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

export async function PokedexProfile({ pokemon, species, flavorText }: Props) {
  const t = await getTranslations("pokedex");

  const artwork =
    pokemon.sprites.other?.["official-artwork"]?.front_default ??
    pokemon.sprites.other?.home?.front_default ??
    pokemon.sprites.front_default;

  const generation = species.generation
    ? GENERATION_ROMAN[species.generation.name] ?? titleCase(species.generation.name)
    : null;
  const growthRate = species.growth_rate
    ? GROWTH_RATE_NL[species.growth_rate.name] ?? titleCase(species.growth_rate.name)
    : null;
  const eggGroups = species.egg_groups.map((g) => titleCase(g.name)).join(", ");
  const captureRate = species.capture_rate;
  // 0-8 achtsten female; -1 = geslachtloos
  const femalePct = species.gender_rate >= 0 ? (species.gender_rate / 8) * 100 : null;

  const abilities = [...pokemon.abilities].sort((a, b) => a.slot - b.slot);

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* Artwork */}
        <div className="relative mx-auto aspect-square w-48 shrink-0 md:w-60">
          {artwork ? (
            <Image
              src={artwork}
              alt={titleCase(species.name)}
              fill
              className="object-contain"
              sizes="240px"
              unoptimized
            />
          ) : (
            <div className="flex size-full items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
              {t("noArtwork")}
            </div>
          )}
        </div>

        <div className="flex-1 space-y-4">
          {flavorText && (
            <p className="text-sm italic leading-relaxed text-foreground">
              &ldquo;{flavorText}&rdquo;
            </p>
          )}

          {/* Feiten-grid */}
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            <Fact label={t("height")} value={formatHeight(pokemon.height)} />
            <Fact label={t("weight")} value={formatWeight(pokemon.weight)} />
            {generation && <Fact label={t("generation")} value={generation} />}
            {species.habitat && (
              <Fact label={t("habitat")} value={titleCase(species.habitat.name)} />
            )}
            {eggGroups && <Fact label={t("eggGroups")} value={eggGroups} />}
            {growthRate && <Fact label={t("growthRate")} value={growthRate} />}
            <Fact label={t("captureRate")} value={`${captureRate} / 255`} />
            {species.base_happiness != null && (
              <Fact label={t("baseHappiness")} value={String(species.base_happiness)} />
            )}
          </dl>

          {/* Vaardigheden */}
          {abilities.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("abilities")}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {abilities.map((a) => (
                  <span
                    key={a.ability.name}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground"
                  >
                    {titleCase(a.ability.name)}
                    {a.is_hidden && (
                      <span className="text-[10px] font-normal text-muted-foreground">
                        ({t("hiddenAbility")})
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Geslachtsverdeling */}
          <div>
            <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("gender")}
            </h3>
            {femalePct === null ? (
              <p className="text-sm text-muted-foreground">{t("genderless")}</p>
            ) : (
              <div className="max-w-xs">
                <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className="bg-sky-500" style={{ width: `${100 - femalePct}%` }} />
                  <div className="bg-pink-400" style={{ width: `${femalePct}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span className="text-sky-600 dark:text-sky-400">
                    ♂ {(100 - femalePct).toFixed(1).replace(/\.0$/, "")}%
                  </span>
                  <span className="text-pink-600 dark:text-pink-400">
                    ♀ {femalePct.toFixed(1).replace(/\.0$/, "")}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
