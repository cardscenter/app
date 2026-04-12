import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { LootboxOpener } from "@/components/customization/lootbox-opener";
import { EmberBalance } from "@/components/customization/ember-balance";
import { EmberIcon } from "@/components/customization/ember-icon";
import { getRarity } from "@/lib/cosmetic-config";
import { getArtist, countryFlag } from "@/lib/fan-artists";
import { cn } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function OpenLootboxPage({
  params,
}: {
  params: Promise<{ lootboxId: string }>;
}) {
  const { lootboxId } = await params;
  const t = await getTranslations("customization");
  const session = await auth();

  const lootbox = await prisma.lootbox.findUnique({
    where: { id: lootboxId, isActive: true },
    include: {
      bundle: true,
      items: {
        include: {
          item: {
            select: { id: true, key: true, name: true, rarity: true, type: true, assetPath: true, artistKey: true },
          },
        },
      },
    },
  });

  if (!lootbox) notFound();

  let emberBalance = 0;
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emberBalance: true },
    });
    emberBalance = user?.emberBalance ?? 0;
  }

  const previewItems = lootbox.items.map((li) => ({
    id: li.item.id,
    key: li.item.key,
    name: li.item.name,
    rarity: li.item.rarity,
    type: li.item.type,
    assetPath: li.item.assetPath,
    artistKey: li.item.artistKey,
  }));

  // Rarity chances
  const rarities = ["UNCOMMON", "RARE", "EPIC", "LEGENDARY", "UNIQUE", "SHINY"] as const;
  const weights = [
    lootbox.weightUncommon,
    lootbox.weightRare,
    lootbox.weightEpic,
    lootbox.weightLegendary,
    lootbox.weightUnique,
    lootbox.weightShiny,
  ];
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  // Group items by rarity for the catalog
  const itemsByRarity = rarities
    .map((rarity, i) => ({
      rarity,
      percent: (weights[i] / totalWeight) * 100,
      items: previewItems
        .filter((item) => item.rarity === rarity)
        .sort((a, b) => {
          const order = ["BANNER", "BACKGROUND", "EMBLEM", "XP_REWARD", "EMBER_REWARD"];
          return order.indexOf(a.type) - order.indexOf(b.type);
        }),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/customization/packs" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{lootbox.name}</h1>
          <p className="text-sm text-muted-foreground">{lootbox.bundle.name}</p>
        </div>
        {session?.user?.id && <EmberBalance balance={emberBalance} size="lg" />}
      </div>

      {/* Rarity chances bar */}
      <div className="mb-6 glass rounded-2xl p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("rarityChances")}</p>
        <div className="flex h-3 overflow-hidden rounded-full">
          {rarities.map((rarity, i) => {
            if (weights[i] === 0) return null;
            const percent = (weights[i] / totalWeight) * 100;
            const r = getRarity(rarity);
            return (
              <div
                key={rarity}
                className={cn(
                  "transition-all first:rounded-l-full last:rounded-r-full",
                  rarity === "SHINY" && "shiny-bar"
                )}
                style={{ width: `${percent}%`, ...rarity !== "SHINY" ? { backgroundColor: r.color } : {} }}
                title={`${r.label}: ${percent.toFixed(1)}%`}
              />
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {rarities.map((rarity, i) => {
            if (weights[i] === 0) return null;
            const percent = (weights[i] / totalWeight) * 100;
            const r = getRarity(rarity);
            return (
              <span key={rarity} className="flex items-center gap-1.5 text-xs">
                <span
                  className={cn("size-2 rounded-full", rarity === "SHINY" && "shiny-dot")}
                  style={rarity !== "SHINY" ? { backgroundColor: r.color } : {}}
                />
                <span className={cn("font-semibold", r.textColor)}>{r.label}</span>
                <span className="text-muted-foreground">{percent.toFixed(1)}%</span>
              </span>
            );
          })}
        </div>
      </div>

      <LootboxOpener
        lootboxId={lootbox.id}
        lootboxName={lootbox.name}
        emberCost={lootbox.emberCost}
        lootboxImage={lootbox.imageUrl}
        previewItems={previewItems}
        currentBalance={emberBalance}
        isLoggedIn={!!session?.user?.id}
      />

      {/* Pack Contents Catalog */}
      <div className="mt-12">
        <h2 className="mb-6 text-xl font-bold">{t("packContents")}</h2>
        <div className="space-y-8">
          {itemsByRarity.map((group) => {
            const r = getRarity(group.rarity);
            return (
              <div key={group.rarity}>
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className={cn("size-3 rounded-full", group.rarity === "SHINY" && "shiny-dot")}
                    style={group.rarity !== "SHINY" ? { backgroundColor: r.color } : {}}
                  />
                  <h3 className={cn("font-bold", r.textColor)}>{r.label}</h3>
                  <span className="text-sm text-muted-foreground">— {group.percent.toFixed(1)}% kans</span>
                  <span className="text-sm text-muted-foreground">({group.items.length} items)</span>
                </div>
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {group.items.map((item) => {
                    const isShiny = item.rarity === "SHINY";
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "relative overflow-hidden rounded-xl border bg-card transition-all",
                          r.borderColor,
                          isShiny ? "glow-shiny" : "hover:scale-[1.02] hover:shadow-lg"
                        )}
                      >
                        {isShiny ? (
                          /* Shiny: blurred with lock overlay */
                          <div className="relative">
                            <div className="aspect-video bg-gradient-to-br from-red-500/20 via-blue-500/20 to-purple-500/20">
                              {item.assetPath ? (
                                <img src={item.assetPath} alt="" className="size-full object-cover blur-xl brightness-50" />
                              ) : (
                                <div className="size-full bg-gradient-to-br from-purple-900/40 via-blue-900/40 to-pink-900/40" />
                              )}
                            </div>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <div className="rounded-full bg-black/40 p-2.5 backdrop-blur-sm">
                                <svg className="size-6 shiny-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        ) : item.assetPath ? (
                          <div className="relative aspect-video overflow-hidden bg-muted">
                            <img src={item.assetPath} alt={item.name} className="size-full object-cover" />
                            <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
                              {item.type === "BANNER" ? "Banner" : item.type === "EMBLEM" ? "Emblem" : item.type === "BACKGROUND" ? "Background" : item.type}
                            </span>
                          </div>
                        ) : (
                          <div className={cn("relative flex aspect-video items-center justify-center", r.bgColor)}>
                            {item.type === "EMBER_REWARD" ? (
                              <EmberIcon className="size-24" />
                            ) : (
                              <span className="text-6xl">{item.type === "BANNER" ? "🖼️" : item.type === "EMBLEM" ? "🛡️" : item.type === "XP_REWARD" ? "⭐" : "✨"}</span>
                            )}
                            <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
                              {item.type === "BANNER" ? "Banner" : item.type === "EMBLEM" ? "Emblem" : item.type === "BACKGROUND" ? "Background" : item.type === "XP_REWARD" ? "XP" : "Ember"}
                            </span>
                          </div>
                        )}
                        <div className="p-2 text-center">
                          <p className={cn("text-sm font-medium", isShiny && "shiny-text font-bold")}>
                            {isShiny ? "???" : item.name}
                          </p>
                          {!isShiny && item.artistKey && (() => {
                            const artist = getArtist(item.artistKey);
                            return artist ? (
                              <p className="mt-0.5 text-[10px] text-muted-foreground">
                                {countryFlag(artist.country)} {artist.name}
                              </p>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
