import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { Package, Backpack, Paintbrush } from "lucide-react";
import { EmberBalance } from "@/components/customization/ember-balance";
import { EmberIcon } from "@/components/customization/ember-icon";
import { RarityBadge } from "@/components/customization/rarity-badge";
import { EmberPurchaseButton } from "@/components/customization/ember-purchase-button";

export default async function CustomizationPage() {
  const t = await getTranslations("customization");
  const session = await auth();

  const bundles = await prisma.cosmeticBundle.findMany({
    where: { isActive: true },
    include: {
      lootboxes: { where: { isActive: true }, orderBy: { emberCost: "asc" } },
      _count: { select: { items: true } },
    },
    orderBy: { sortOrder: "asc" },
  });

  let emberBalance = 0;
  let ownedCount = 0;
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emberBalance: true },
    });
    emberBalance = user?.emberBalance ?? 0;
    ownedCount = await prisma.ownedItem.count({
      where: { userId: session.user.id },
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Ember Balance Bar */}
      {session?.user?.id && (
        <div className="mb-8 flex items-center justify-between rounded-lg border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <EmberIcon className="size-6" />
              <div>
                <p className="text-sm text-muted-foreground">{t("emberBalance")}</p>
                <EmberBalance balance={emberBalance} size="lg" />
              </div>
            </div>
          </div>
          <EmberPurchaseButton />
        </div>
      )}

      {/* Quick Nav */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Link
          href="/customization/packs"
          className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted"
        >
          <Package className="size-8 text-purple-500" />
          <div>
            <p className="font-semibold">{t("packs")}</p>
            <p className="text-sm text-muted-foreground">{t("packsSubtitle")}</p>
          </div>
        </Link>
        <Link
          href="/customization/inventory"
          className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted"
        >
          <Backpack className="size-8 text-blue-500" />
          <div>
            <p className="font-semibold">{t("inventory")}</p>
            <p className="text-sm text-muted-foreground">
              {ownedCount > 0 ? `${ownedCount} items` : t("noItems")}
            </p>
          </div>
        </Link>
        <Link
          href="/customization/equip"
          className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted"
        >
          <Paintbrush className="size-8 text-emerald-500" />
          <div>
            <p className="font-semibold">{t("equipTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("equipSubtitle")}</p>
          </div>
        </Link>
      </div>

      {/* Featured Bundles */}
      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold">{t("featuredBundles")}</h2>
        {bundles.length === 0 ? (
          <p className="text-muted-foreground">{t("noPacks")}</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {bundles.map((bundle) => (
              <div key={bundle.id} className="overflow-hidden rounded-lg border bg-card">
                {bundle.imageUrl && (
                  <div className="aspect-video bg-muted">
                    <img
                      src={bundle.imageUrl}
                      alt={bundle.name}
                      className="size-full object-cover"
                    />
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-semibold">{bundle.name}</h3>
                  {bundle.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{bundle.description}</p>
                  )}
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("containsItems", { count: bundle._count.items })}
                  </p>
                  {bundle.lootboxes.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {bundle.lootboxes.map((lootbox) => (
                        <Link
                          key={lootbox.id}
                          href={`/customization/open/${lootbox.id}`}
                          className="inline-flex items-center gap-1.5 rounded-md bg-orange-500/10 px-3 py-1.5 text-sm font-medium text-orange-600 transition-colors hover:bg-orange-500/20 dark:text-orange-400"
                        >
                          <EmberIcon className="size-3.5" />
                          {lootbox.emberCost} — {lootbox.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* How to Earn Ember */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-3 text-xl font-semibold">{t("earnEmber")}</h2>
        <p className="mb-4 text-sm text-muted-foreground">{t("earnEmberDesc")}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Aankoop voltooien", ember: 10 },
            { label: "Verkoop voltooien", ember: 10 },
            { label: "Review geven", ember: 5 },
            { label: "Bod plaatsen", ember: 2 },
            { label: "Item listen", ember: 2 },
            { label: "Review ontvangen (4-5★)", ember: 3 },
            { label: "Dagelijkse login", ember: 5 },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
              <span className="text-sm">{item.label}</span>
              <span className="flex items-center gap-1 text-sm font-semibold text-orange-500">
                <EmberIcon className="size-3" />
                {item.ember}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span>{t("free")}: {t("dailyCapDesc", { amount: 50 })}</span>
          <span>•</span>
          <span>{t("pro")}: {t("dailyCapDesc", { amount: 100 })}</span>
          <span>•</span>
          <span>{t("unlimited")}: {t("dailyCapUnlimited")}</span>
        </div>
      </div>
    </div>
  );
}
