/**
 * Spellen in de hub (Community Hub, Fase 2). Client-safe constants; de
 * DB-laag (GameOption-tabel, admin aan/uit) staat in `games-server.ts`.
 */

export type GameDefinition = {
  key: string;
  name: string;
  enabled: boolean;
  sortOrder: number;
  /** Label van het officiële spelers-ID; null = geen ID voor dit spel. */
  playerIdLabel: string | null;
};

/** Defaults: Pokémon, Yu-Gi-Oh! en Lorcana aan; de rest kan een admin aanzetten. */
export const DEFAULT_GAMES: GameDefinition[] = [
  { key: "pokemon", name: "Pokémon", enabled: true, sortOrder: 1, playerIdLabel: "Play! Pokémon Player ID" },
  { key: "yugioh", name: "Yu-Gi-Oh!", enabled: true, sortOrder: 2, playerIdLabel: "Konami ID (Card Game ID)" },
  { key: "lorcana", name: "Disney Lorcana", enabled: true, sortOrder: 3, playerIdLabel: null },
  { key: "onepiece", name: "One Piece Card Game", enabled: false, sortOrder: 4, playerIdLabel: "Bandai TCG+ ID" },
  { key: "mtg", name: "Magic: The Gathering", enabled: false, sortOrder: 5, playerIdLabel: null },
  { key: "digimon", name: "Digimon Card Game", enabled: false, sortOrder: 6, playerIdLabel: "Bandai TCG+ ID" },
];

export const GAME_KEYS = DEFAULT_GAMES.map((g) => g.key);

const PLAYER_ID_MAX = 40;
const PLAYER_ID_RE = /^[A-Za-z0-9 ._-]{1,40}$/;

/** JSON string[] → unieke, bekende game-keys. Onbekend/kapot = leeg. */
export function parseFavoriteGames(raw: string | null | undefined, knownKeys: readonly string[] = GAME_KEYS): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const out: string[] = [];
    for (const v of arr) {
      if (typeof v === "string" && knownKeys.includes(v) && !out.includes(v)) out.push(v);
    }
    return out;
  } catch {
    return [];
  }
}

/** JSON { gameKey: id } → object met alleen bekende keys en nette waarden. */
export function parsePlayerIds(raw: string | null | undefined, knownKeys: readonly string[] = GAME_KEYS): Record<string, string> {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (!knownKeys.includes(k) || typeof v !== "string") continue;
      const trimmed = v.trim();
      if (trimmed && PLAYER_ID_RE.test(trimmed)) out[k] = trimmed;
    }
    return out;
  } catch {
    return {};
  }
}

/** Valideert één spelers-ID uit een formulier. Leeg = ok (verwijderen). */
export function validatePlayerId(value: string): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: "" };
  if (trimmed.length > PLAYER_ID_MAX) return { ok: false, error: `Maximaal ${PLAYER_ID_MAX} tekens` };
  if (!PLAYER_ID_RE.test(trimmed)) return { ok: false, error: "Alleen letters, cijfers, spaties, punten, streepjes" };
  return { ok: true, value: trimmed };
}
