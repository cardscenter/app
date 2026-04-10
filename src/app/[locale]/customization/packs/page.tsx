import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { EmberIcon } from "@/components/customization/ember-icon";
import { RarityBadge } from "@/components/customization/rarity-badge";
import { EmberBalance } from "@/components/customization/ember-balance";

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
        <Link href="/customization" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{t("packsTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("packsSubtitle")}</p>
        </div>
        {session?.user?.id && <EmberBalance balance={emberBalance} size="lg" />}
      </div>

      {bundles.length === 0 ? (
        <p className="text-muted-foreground">{t("noPacks")}</p>
      ) : (
        <div className="space-y-8">
          {bundles.map((bundle) => (
            <div key={bundle.id}>
              <h2 className="mb-4 text-xl font-semibold">{bundle.name}</h2>
              {bundle.description && (
                <p className="mb-4 text-muted-foreground">{bundle.description}</p>
              )}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {bundle.lootboxes.map((lootbox) => {
                  const rarities = ["UNCOMMON", "RARE", "EPIC", "LEGENDARY", "UNIQUE"];
                  const weights = [
                    lootbox.weightUncommon,
                    lootbox.weightRare,
                    lootbox.weightEpic,
                    lootbox.weightLegendary,
                    lootbox.weightUnique,
                  ];
                  const totalWeight = weights.reduce((a, b) => a + b, 0);

                  return (
                    <div key={lootbox.id} className="overflow-hidden rounded-lg border bg-card">
                      {lootbox.imageUrl && (
                        <div className="aspect-video bg-muted">
                          <img src={lootbox.imageUrl} alt={lootbox.name} className="size-full object-cover" />
                        </div>
                      )}
                      <div className="p-4">
                        <h3 className="font-semibold">{lootbox.name}</h3>
                        {lootbox.description && (
                          <p className="mt-1 text-sm text-muted-foreground">{lootbox.description}</p>
                        )}

                        <div className="mt-3 flex items-center gap-2">
                          <EmberIcon className="size-4" />
                          <span className="font-semibold">{lootbox.emberCost} Ember</span>
                        </div>

                        {/* Rarity chances */}
                        <div className="mt-3">
                          <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("rarityChances")}</p>
                          <div className="space-y-1">
                            {rarities.map((rarity, i) => {
                              const percent = ((weights[i] / totalWeight) * 100).toFixed(1);
                              if (weights[i] === 0) return null;
                              return (
                                <div key={rarity} className="flex items-center justify-between text-xs">
                                  <RarityBadge rarity={rarity} />
                                  <span className="text-muted-foreground">{percent}%</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <Link
                          href={`/customization/open/${lootbox.id}`}
                          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
                        >
                          <EmberIcon className="size-4" />
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
