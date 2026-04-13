import { prisma } from "@/lib/prisma";
import { extractSetIdFromCardId } from "./client";

/**
 * Given a TCGdex card id (e.g. "base1-4"), find the matching local
 * CardSet via its `tcgdexSetId` and return its database id. Returns null
 * if the set hasn't been imported (run `npx tsx prisma/seed-tcgdex-sets.ts`).
 */
export async function resolveLocalCardSetId(
  tcgdexCardId: string | null | undefined
): Promise<string | null> {
  if (!tcgdexCardId) return null;
  const tcgdexSetId = extractSetIdFromCardId(tcgdexCardId);
  if (!tcgdexSetId) return null;

  const set = await prisma.cardSet.findUnique({
    where: { tcgdexSetId },
    select: { id: true },
  });
  return set?.id ?? null;
}
