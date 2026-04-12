import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { EmberIcon } from "@/components/customization/ember-icon";
import { EmberBalance } from "@/components/customization/ember-balance";
import { getRarity } from "@/lib/cosmetic-config";
import { cn } from "@/lib/utils";

export default async function PacksPage() {
  const t = await getTranslations("customization");
  const session = await auth();

  const bundles = await prisma.cosmeticBundle.findMany({
    where: { isActive: true },
    include: {
      lootboxes: {
        where: { isActive: true },
        orderBy: { emberCost: "asc" },
        include: {
          items: {
            include: {
              item: { select: { id: true, name: true, rarity: true, type: true } },
            },
          },
        },
      },
      _count: { select: { items: true } },
    },
    orderBy: { sortOrder: "asc" },
  });

  let emberBalance = 0;
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emberBalance: true },
    });
    emberBalance = user?.emberBalance ?? 0;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/customization" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{t("packsTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("packsSubtitle")}</p>
        </div>
        {session?.user?.id && <EmberBalance balance={emberBalance} size="lg" />}
      </div>

      {/* Fan-Art Disclaimer */}
      <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-3 text-center text-xs text-muted-foreground">
        <p>{t("fanArtDisclaimer")}</p>
      </div>

      {bundles.length === 0 ? (
        <p className="text-muted-foreground">{t("noPacks")}</p>
      ) : (
        <div className="space-y-10">
          {bundles.map((bundle) => (
            <div key={bundle.id}>
              <h2 className="mb-2 text-xl font-bold">{bundle.name}</h2>
              {bundle.description && (
                <p className="mb-5 text-muted-foreground">{bundle.description}</p>
              )}

              <div className="grid gap-6 sm:grid-cols-2">
                {bundle.lootboxes.map((lootbox) => {
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

                  return (
                    <div key={lootbox.id} className="glass overflow-hidden rounded-2xl">
                      {/* Lootbox cover */}
                      {lootbox.imageUrl && (
                        <div className="relative h-48 overflow-hidden bg-gradient-to-b from-slate-900 to-slate-800">
                          <img src={lootbox.imageUrl} alt={lootbox.name} className="size-full object-cover opacity-90" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                          <div className="absolute bottom-4 left-4">
                            <h3 className="text-xl font-bold text-white">{lootbox.name}</h3>
                            <div className="mt-1 flex items-center gap-1.5 font-bold text-orange-400">
                              <EmberIcon className="size-5" />
                              <span className="text-lg">{lootbox.emberCost} Ember</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="p-5">
                        {!lootbox.imageUrl && (
                          <>
                            <h3 className="text-lg font-bold">{lootbox.name}</h3>
                            <div className="mt-1 flex items-center gap-1.5">
                              <EmberIcon className="size-4" />
                              <span className="font-bold text-orange-500">{lootbox.emberCost} Ember</span>
                            </div>
                          </>
                        )}

                        {lootbox.description && (
                          <p className="mt-2 text-sm text-muted-foreground">{lootbox.description}</p>
                        )}

                        {/* Visual rarity bars */}
                        <div className="mt-4 space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("rarityChances")}</p>
                          {rarities.map((rarity, i) => {
                            if (weights[i] === 0) return null;
                            const percent = (weights[i] / totalWeight) * 100;
                            const r = getRarity(rarity);
                            return (
                              <div key={rarity} className="flex items-center gap-3">
                                <span className={cn("w-20 text-xs font-semibold", r.textColor)}>{r.label}</span>
                                <div className="flex-1 overflow-hidden rounded-full bg-muted/50 h-2">
                                  <div
                                    className={cn("h-full rounded-full transition-all", rarity === "SHINY" && "shiny-bar")}
                                    style={{
                                      width: `${Math.max(percent, 2)}%`,
                                      ...rarity !== "SHINY" ? { backgroundColor: r.color } : {},
                                    }}
                                  />
                                </div>
                                <span className="w-12 text-right text-xs font-medium text-muted-foreground">{percent.toFixed(1)}%</span>
                              </div>
                            );
                          })}
                        </div>

                        <Link
                          href={`/customization/open/${lootbox.id}`}
                          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 font-bold text-white shadow-lg shadow-orange-500/20 transition-all hover:shadow-orange-500/40 hover:brightness-110"
                        >
                          <EmberIcon className="size-5" />
                          {t("openPack")}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
