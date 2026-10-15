import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { DEFAULT_GAMES, type GameDefinition } from "./games";

let seeded = false;

/**
 * Zorgt dat de GameOption-tabel de defaults bevat (idempotent, 1x per proces).
 * Nieuwe spellen uit DEFAULT_GAMES komen er zo vanzelf bij op live.
 */
export async function ensureGameOptions(): Promise<void> {
  if (seeded) return;
  const existing = await prisma.gameOption.findMany({ select: { key: true } });
  const have = new Set(existing.map((g) => g.key));
  const missing = DEFAULT_GAMES.filter((g) => !have.has(g.key));
  if (missing.length > 0) {
    await prisma.gameOption.createMany({ data: missing });
  }
  seeded = true;
}

/** Alle spellen (ook uitgeschakelde), gesorteerd. Voor admin + validatie. */
export const listGames = cache(async function listGames(): Promise<GameDefinition[]> {
  await ensureGameOptions();
  const rows = await prisma.gameOption.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map((r) => ({
    key: r.key,
    name: r.name,
    enabled: r.enabled,
    sortOrder: r.sortOrder,
    playerIdLabel: r.playerIdLabel,
  }));
});

/** Alleen de spellen die een speler mag kiezen. */
export async function listEnabledGames(): Promise<GameDefinition[]> {
  return (await listGames()).filter((g) => g.enabled);
}
