import { Gamepad2 } from "lucide-react";
import { listGames } from "@/lib/games-server";
import { prisma } from "@/lib/prisma";
import { parseFavoriteGames } from "@/lib/games";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { GameOptionsTable } from "@/components/admin/game-options-table";

export const dynamic = "force-dynamic";

/**
 * Spellen beheren (Community Hub, Fase 2): welke spellen spelers als
 * favoriet kunnen kiezen (+ spelers-ID). One Piece, Magic en Digimon staan
 * klaar en kunnen hier aangezet worden zodra de winkel ze voert.
 */
export default async function AdminGamesPage() {
  const games = await listGames();

  // Hoeveel spelers hebben elk spel als favoriet? (klein; alle users met favorieten)
  const rows = await prisma.user.findMany({
    where: { favoriteGames: { not: null }, deletedAt: null },
    select: { favoriteGames: true },
  });
  const counts: Record<string, number> = {};
  for (const r of rows) {
    for (const k of parseFavoriteGames(r.favoriteGames, games.map((g) => g.key))) {
      counts[k] = (counts[k] ?? 0) + 1;
    }
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Spellen"
        subtitle="Welke spellen spelers kunnen kiezen als favoriet en waarvoor ze een spelers-ID kunnen opgeven. Uitzetten verbergt het spel in profielen en registratie; opgeslagen keuzes blijven bewaard."
      />
      <DashboardSection title="Beschikbare spellen" icon={<Gamepad2 className="size-5" />} contentClassName="p-0">
        <GameOptionsTable games={games.map((g) => ({ ...g, favoriteCount: counts[g.key] ?? 0 }))} />
      </DashboardSection>
    </div>
  );
}
