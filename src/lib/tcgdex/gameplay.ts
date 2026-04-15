// Unified gameplay-detail lookup (attacks, abilities, weakness, resistance,
// retreat, stage, etc.).
//
// Same story as pricing: TCGdex's coverage is spotty for some cards (notably
// SVP promos and Japanese-tagged sets), while pokemontcg.io has the full
// gameplay block for the same card. We take TCGdex as the primary source and
// backfill any missing fields from pokemontcg.io.

import type {
  TCGdexCardFull,
  TCGdexAttack,
  TCGdexAbility,
} from "./types";
import { resolvePtcgFromTcgCard, type PtcgCard } from "./ptcgio";

type PtcgAttack = NonNullable<PtcgCard["attacks"]>[number];
type PtcgAbility = NonNullable<PtcgCard["abilities"]>[number];

function extractStageFromSubtypes(subtypes: string[] | undefined): string | undefined {
  if (!subtypes) return undefined;
  if (subtypes.includes("Basic")) return "Basic";
  if (subtypes.includes("Stage 1")) return "Stage1";
  if (subtypes.includes("Stage 2")) return "Stage2";
  if (subtypes.includes("Mega")) return "Mega";
  if (subtypes.includes("VMAX")) return "VMAX";
  if (subtypes.includes("VSTAR")) return "VSTAR";
  return undefined;
}

function extractTrainerType(supertype: string | undefined, subtypes: string[] | undefined): string | undefined {
  if (supertype !== "Trainer" || !subtypes) return undefined;
  const known = ["Item", "Supporter", "Stadium", "Pokémon Tool", "Technical Machine"];
  return subtypes.find((s) => known.includes(s));
}

function mapPtcgAttack(a: PtcgAttack): TCGdexAttack {
  return {
    name: a.name,
    cost: a.cost,
    damage: a.damage,
    effect: a.text || undefined,
  };
}

function mapPtcgAbility(a: PtcgAbility): TCGdexAbility {
  return { name: a.name, type: a.type, effect: a.text };
}

/**
 * Returns a card with gameplay details from TCGdex, with missing fields
 * filled in from pokemontcg.io. Accepts the TCGdex card as the starting
 * point (so the caller controls caching/lookup of that source).
 */
export async function mergeGameplayDetails(
  tcgCard: TCGdexCardFull | null,
  tcgdexCardId: string
): Promise<TCGdexCardFull | null> {
  if (!tcgCard) return null;

  // TCGdex sometimes returns the literal string "None" instead of null —
  // treat that as "missing" so the fallback kicks in.
  const isMissing = (v: unknown) => v === null || v === undefined || v === "None" || v === "";

  const hasAll =
    (tcgCard.attacks && tcgCard.attacks.length > 0) &&
    tcgCard.weaknesses !== undefined && tcgCard.weaknesses !== null &&
    tcgCard.retreat !== undefined && tcgCard.retreat !== null &&
    !isMissing(tcgCard.rarity) &&
    !isMissing(tcgCard.illustrator) &&
    tcgCard.hp !== undefined;

  if (hasAll) return tcgCard;

  // Resolve via the 3-step cascade (id-as-is → transformed-id → name+set search).
  const ptcg = await resolvePtcgFromTcgCard(tcgCard, tcgdexCardId);
  if (!ptcg) return tcgCard;

  // Merge: TCGdex fields win where present; fill in missing fields from ptcg
  const merged: TCGdexCardFull = {
    ...tcgCard,
    attacks: tcgCard.attacks && tcgCard.attacks.length > 0
      ? tcgCard.attacks
      : ptcg.attacks?.map(mapPtcgAttack),
    abilities: tcgCard.abilities && tcgCard.abilities.length > 0
      ? tcgCard.abilities
      : ptcg.abilities?.map(mapPtcgAbility),
    weaknesses: (tcgCard.weaknesses && tcgCard.weaknesses.length > 0)
      ? tcgCard.weaknesses
      : ptcg.weaknesses,
    resistances: (tcgCard.resistances && tcgCard.resistances.length > 0)
      ? tcgCard.resistances
      : ptcg.resistances,
    retreat: tcgCard.retreat !== undefined
      ? tcgCard.retreat
      : (ptcg.convertedRetreatCost ?? ptcg.retreatCost?.length),
    evolveFrom: tcgCard.evolveFrom ?? ptcg.evolvesFrom,
    stage: tcgCard.stage ?? extractStageFromSubtypes(ptcg.subtypes),
    dexId: tcgCard.dexId ?? ptcg.nationalPokedexNumbers,
    regulationMark: tcgCard.regulationMark ?? ptcg.regulationMark,
    legal: tcgCard.legal ?? (ptcg.legalities
      ? {
          standard: ptcg.legalities.standard === "Legal",
          expanded: ptcg.legalities.expanded === "Legal",
        }
      : undefined),
    trainerType: tcgCard.trainerType ?? extractTrainerType(ptcg.supertype, ptcg.subtypes),
    effect: tcgCard.effect ?? ptcg.rules?.join("\n\n"),
    rarity: isMissing(tcgCard.rarity) ? ptcg.rarity : tcgCard.rarity,
    illustrator: isMissing(tcgCard.illustrator) ? ptcg.artist : tcgCard.illustrator,
    hp: tcgCard.hp ?? (ptcg.hp ? parseInt(ptcg.hp, 10) : undefined),
    types: (tcgCard.types && tcgCard.types.length > 0) ? tcgCard.types : ptcg.types,
  };

  return merged;
}
