import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ChevronRight, CornerDownRight } from "lucide-react";
import { dexIdFromUrl, type EvolutionChainNode } from "@/lib/pokeapi/client";
import { pokedexSlug } from "@/lib/pokeapi/slug";
import { formatEvolutionTrigger } from "@/lib/pokeapi/evolution-trigger";

function titleCase(s: string): string {
  return s.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// Public static-sprite URL pattern — works for every national-dex ID
// without needing an extra PokéAPI call per node.
function spriteUrl(dexId: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexId}.png`;
}

function EvolutionNode({
  node,
  trigger,
}: {
  node: EvolutionChainNode;
  /** Trigger-label onder de naam (alleen in branch-grid-weergave). */
  trigger?: string | null;
}) {
  const dexId = dexIdFromUrl(node.species.url);
  const name = titleCase(node.species.name);
  if (dexId === null) {
    return (
      <div className="flex flex-col items-center text-xs text-muted-foreground">
        {name}
      </div>
    );
  }
  return (
    <Link
      href={`/pokedex/${pokedexSlug(node.species.name, dexId)}`}
      className="group flex flex-col items-center gap-1 rounded-xl p-2 transition-colors hover:bg-muted/60"
    >
      <div className="relative size-16 sm:size-20">
        <Image
          src={spriteUrl(dexId)}
          alt={name}
          fill
          className="object-contain transition-transform group-hover:scale-105"
          sizes="80px"
          unoptimized
        />
      </div>
      <div className="text-center">
        <div className="text-xs font-mono text-muted-foreground">
          #{String(dexId).padStart(4, "0")}
        </div>
        <div className="text-sm font-semibold text-foreground">{name}</div>
        {trigger && (
          <div className="mt-0.5 inline-block max-w-[9rem] truncate rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {trigger}
          </div>
        )}
      </div>
    </Link>
  );
}

function EvolutionArrow({ trigger }: { trigger: string | null }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5">
      <ChevronRight className="size-5 text-muted-foreground/60" />
      {trigger && (
        <span className="whitespace-nowrap rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {trigger}
        </span>
      )}
    </div>
  );
}

/** Lineair stuk keten als horizontale rij: node → node → node. */
function LinearRow({ nodes }: { nodes: EvolutionChainNode[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {nodes.map((n, i) => (
        <div key={n.species.name} className="flex items-center gap-1.5">
          {i > 0 && <EvolutionArrow trigger={formatEvolutionTrigger(n.evolution_details)} />}
          <EvolutionNode node={n} />
        </div>
      ))}
    </div>
  );
}

/** Flatten een keten zolang die niet vertakt. Retourneert het lineaire stuk
 * plus de vertakkingen aan het eind (leeg als de keten volledig lineair is). */
function flattenLinear(node: EvolutionChainNode): {
  linear: EvolutionChainNode[];
  branches: EvolutionChainNode[];
} {
  const linear: EvolutionChainNode[] = [node];
  let current = node;
  while (current.evolves_to.length === 1) {
    linear.push(current.evolves_to[0]);
    current = current.evolves_to[0];
  }
  return { linear, branches: current.evolves_to.length > 1 ? current.evolves_to : [] };
}

interface Props {
  chain: EvolutionChainNode;
}

export async function PokedexEvolutionChain({ chain }: Props) {
  const t = await getTranslations("pokedex");
  const hasAnyEvolution = chain.evolves_to.length > 0;
  const { linear, branches } = flattenLinear(chain);

  // Alle vertakkingen zonder verdere evoluties (bv. Eevee → 8 eeveelutions)?
  // Dan een compacte grid met de trigger onder elke tile — voorkomt dat het
  // blok metershoog wordt. Vertakkingen mét vervolg-evoluties (bv. Wurmple →
  // Silcoon → Beautifly / Cascoon → Dustox) krijgen elk een eigen rij.
  const allBranchesAreLeaves = branches.every((b) => b.evolves_to.length === 0);

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-4 text-lg font-bold text-foreground">{t("evolution")}</h2>
      {!hasAnyEvolution ? (
        <p className="text-sm text-muted-foreground">{t("noEvolution")}</p>
      ) : branches.length === 0 ? (
        <div className="overflow-x-auto">
          <LinearRow nodes={linear} />
        </div>
      ) : allBranchesAreLeaves ? (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <LinearRow nodes={linear} />
            <ChevronRight className="size-5 shrink-0 text-muted-foreground/60" />
          </div>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
            {branches.map((b) => (
              <EvolutionNode
                key={b.species.name}
                node={b}
                trigger={formatEvolutionTrigger(b.evolution_details)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <LinearRow nodes={linear} />
          <div className="space-y-2 pl-2">
            {branches.map((b) => {
              const sub = flattenLinear(b);
              return (
                <div key={b.species.name} className="flex items-center gap-1.5">
                  <CornerDownRight className="size-4 shrink-0 text-muted-foreground/50" />
                  <EvolutionArrow trigger={formatEvolutionTrigger(b.evolution_details)} />
                  <div className="overflow-x-auto">
                    <LinearRow nodes={sub.linear} />
                  </div>
                  {/* Diepere dubbele vertakkingen bestaan niet in de huidige dex */}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
