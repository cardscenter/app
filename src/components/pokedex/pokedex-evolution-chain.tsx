import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ChevronRight } from "lucide-react";
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

function EvolutionNode({ node }: { node: EvolutionChainNode }) {
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
      <div className="relative size-20 sm:size-24">
        <Image
          src={spriteUrl(dexId)}
          alt={name}
          fill
          className="object-contain transition-transform group-hover:scale-105"
          sizes="96px"
          unoptimized
        />
      </div>
      <div className="text-center">
        <div className="text-xs font-mono text-muted-foreground">
          #{String(dexId).padStart(4, "0")}
        </div>
        <div className="text-sm font-semibold text-foreground">{name}</div>
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

function BranchGroup({ nodes }: { nodes: EvolutionChainNode[] }) {
  // When the chain branches (e.g. Eevee → 8 Eeveelutions), each branch has
  // its own trigger — show the arrow + trigger next to each individual node
  // so the reader can see which stone/item applies to which evolution.
  return (
    <div className="flex flex-col gap-2">
      {nodes.map((n) => (
        <div key={n.species.name} className="flex items-center gap-2">
          <EvolutionArrow trigger={formatEvolutionTrigger(n.evolution_details)} />
          <EvolutionNode node={n} />
        </div>
      ))}
    </div>
  );
}

function ChainBranch({ node }: { node: EvolutionChainNode }) {
  // Flatten linear chains — one parent → one child → one grandchild — into
  // a single row. As soon as the chain branches, render each branch under
  // its own arrow.
  const linear: EvolutionChainNode[] = [node];
  let current = node;
  while (current.evolves_to.length === 1) {
    linear.push(current.evolves_to[0]);
    current = current.evolves_to[0];
  }
  const finalBranches = current.evolves_to;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {linear.map((n, i) => (
        <div key={n.species.name} className="flex items-center gap-2">
          {i > 0 && <EvolutionArrow trigger={formatEvolutionTrigger(n.evolution_details)} />}
          <EvolutionNode node={n} />
        </div>
      ))}
      {finalBranches.length > 1 && <BranchGroup nodes={finalBranches} />}
    </div>
  );
}

interface Props {
  chain: EvolutionChainNode;
}

export async function PokedexEvolutionChain({ chain }: Props) {
  const t = await getTranslations("pokedex");
  const hasAnyEvolution = chain.evolves_to.length > 0;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-4 text-lg font-bold text-foreground">{t("evolution")}</h2>
      {hasAnyEvolution ? (
        <div className="overflow-x-auto">
          <ChainBranch node={chain} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("noEvolution")}</p>
      )}
    </section>
  );
}
