import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RarityBadge } from "@/components/customization/rarity-badge";
import { EmberBalance } from "@/components/customization/ember-balance";
import { getRarity } from "@/lib/cosmetic-config";
import { cn } from "@/lib/utils";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; bundle?: string }>;
}) {
  const t = await getTranslations("customization");
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  const sp = await searchParams;
  const filterType = sp.type;
  const filterBundle = sp.bundle;

  const where: Record<string, unknown> = { userId: session.user.id };
  const itemWhere: Record<string, unknown> = {};
  if (filterType) itemWhere.type = filterType;
  if (filterBundle) itemWhere.bundleId = filterBundle;

  const ownedItems = await prisma.ownedItem.findMany({
    where: {
      ...where,
      item: Object.keys(itemWhere).length > 0 ? itemWhere : undefined,
    },
    include: {
      item: {
        include: { bundle: { select: { id: true, key: true, name: true } } },
      },
    },
    orderBy: { obtainedAt: "desc" },
  });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emberBalance: true },
  });

  const bundles = await prisma.cosmeticBundle.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { sortOrder: "asc" },
  });

  const types = ["BANNER", "EMBLEM", "BACKGROUND"];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/customization" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{t("inventoryTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("inventorySubtitle")}</p>
        </div>
        <EmberBalance balance={user?.emberBalance ?? 0} size="lg" />
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/customization/inventory"
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            !filterType && !filterBundle ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
          )}
        >
          Alle
        </Link>
        {types.map((type) => (
          <Link
            key={type}
            href={`/customization/inventory?type=${type}`}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              filterType === type ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            )}
          >
            {t(type === "BANNER" ? "banners" : type === "EMBLEM" ? "emblems" : "backgrounds")}
          </Link>
        ))}
        <span className="mx-1 text-muted-foreground">|</span>
        {bundles.map((bundle) => (
          <Link
            key={bundle.id}
            href={`/customization/inventory?bundle=${bundle.id}`}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              filterBundle === bundle.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            )}
          >
            {bundle.name}
          </Link>
        ))}
      </div>

      {/* Items Grid */}
      {ownedItems.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="text-muted-foreground">{t("noItems")}</p>
          <Link
            href="/customization/packs"
            className="mt-4 inline-flex items-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
          >
            {t("packs")}
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {ownedItems.map((owned) => {
            const rarity = getRarity(owned.item.rarity);
            return (
              <div
                key={owned.id}
                className={cn("overflow-hidden rounded-lg border-2 bg-card", rarity.borderColor)}
              >
                {owned.item.assetPath ? (
                  <div className="aspect-video bg-muted">
                    <img
                      src={owned.item.assetPath}
                      alt={owned.item.name}
                      className="size-full object-cover"
                    />
                  </div>
                ) : (
                  <div className={cn("flex aspect-video items-center justify-center text-3xl", rarity.bgColor)}>
                    {owned.item.type === "BANNER" ? "🖼️" : owned.item.type === "EMBLEM" ? "🛡️" : "✨"}
                  </div>
                )}
                <div className="p-2">
                  <p className="text-sm font-medium line-clamp-1">{owned.item.name}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <RarityBadge rarity={owned.item.rarity} />
                    <span className="text-[10px] text-muted-foreground">{owned.item.bundle.name}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
