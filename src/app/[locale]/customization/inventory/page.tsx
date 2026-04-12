import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";
import { RarityBadge } from "@/components/customization/rarity-badge";
import { EmberBalance } from "@/components/customization/ember-balance";
import { getRarity } from "@/lib/cosmetic-config";
import { getArtist, countryFlag } from "@/lib/fan-artists";
import { cn } from "@/lib/utils";

const RARITY_ORDER: Record<string, number> = {
  UNIQUE: 0,
  LEGENDARY: 1,
  EPIC: 2,
  RARE: 3,
  UNCOMMON: 4,
};

type SortOption = "newest" | "oldest" | "rarity" | "rarity-asc";

const SORT_OPTIONS: SortOption[] = ["newest", "oldest", "rarity", "rarity-asc"];

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; bundle?: string; sort?: string }>;
}) {
  const t = await getTranslations("customization");
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  const sp = await searchParams;
  const filterType = sp.type;
  const filterBundle = sp.bundle;
  const sort = (SORT_OPTIONS.includes(sp.sort as SortOption) ? sp.sort : "newest") as SortOption;

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
    orderBy: { obtainedAt: sort === "oldest" ? "asc" : "desc" },
  });

  // Sort by rarity in JS (not a numeric DB column)
  const sortedItems = sort === "rarity" || sort === "rarity-asc"
    ? [...ownedItems].sort((a, b) => {
        const diff = (RARITY_ORDER[a.item.rarity] ?? 99) - (RARITY_ORDER[b.item.rarity] ?? 99);
        return sort === "rarity" ? diff : -diff;
      })
    : ownedItems;

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

  // Build sort URL preserving current filters
  function sortUrl(s: SortOption) {
    const params = new URLSearchParams();
    if (filterType) params.set("type", filterType);
    if (filterBundle) params.set("bundle", filterBundle);
    if (s !== "newest") params.set("sort", s);
    const qs = params.toString();
    return `/customization/inventory${qs ? `?${qs}` : ""}`;
  }

  // Build filter URL preserving current sort
  function filterUrl(params?: { type?: string; bundle?: string }) {
    const p = new URLSearchParams();
    if (params?.type) p.set("type", params.type);
    if (params?.bundle) p.set("bundle", params.bundle);
    if (sort !== "newest") p.set("sort", sort);
    const qs = p.toString();
    return `/customization/inventory${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/customization" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{t("inventoryTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("inventorySubtitle")}</p>
        </div>
        <EmberBalance balance={user?.emberBalance ?? 0} size="lg" />
      </div>

      {/* Filters + Sort */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Link
            href={filterUrl()}
            className={cn(
              "rounded-xl px-3.5 py-2 text-sm font-medium transition-all",
              !filterType && !filterBundle
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {t("allBundles")}
          </Link>
          {types.map((type) => (
            <Link
              key={type}
              href={filterUrl({ type })}
              className={cn(
                "rounded-xl px-3.5 py-2 text-sm font-medium transition-all",
                filterType === type
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {t(type === "BANNER" ? "banners" : type === "EMBLEM" ? "emblems" : "backgrounds")}
            </Link>
          ))}
          <div className="mx-1 w-px self-stretch bg-border" />
          {bundles.map((bundle) => (
            <Link
              key={bundle.id}
              href={filterUrl({ bundle: bundle.id })}
              className={cn(
                "rounded-xl px-3.5 py-2 text-sm font-medium transition-all",
                filterBundle === bundle.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {bundle.name}
            </Link>
          ))}
        </div>

        {/* Sort */}
        <div className="flex gap-1.5 rounded-xl bg-muted/50 p-1">
          {SORT_OPTIONS.map((s) => (
            <Link
              key={s}
              href={sortUrl(s)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap",
                sort === s
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t(`sort_${s}`)}
            </Link>
          ))}
        </div>
      </div>

      {/* Items Grid */}
      {sortedItems.length === 0 ? (
        <div className="glass rounded-2xl p-16 text-center">
          <Package className="mx-auto mb-4 size-12 text-muted-foreground/30" />
          <p className="text-lg font-medium text-muted-foreground">{t("noItems")}</p>
          <Link
            href="/customization/packs"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 font-semibold text-white shadow-lg shadow-orange-500/20 transition-all hover:shadow-orange-500/40"
          >
            {t("packs")}
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {sortedItems.map((owned) => {
            const rarity = getRarity(owned.item.rarity);
            return (
              <div
                key={owned.id}
                className={cn(
                  "group overflow-hidden rounded-xl border-2 bg-card transition-all hover:scale-[1.02] hover:shadow-lg",
                  rarity.borderColor
                )}
              >
                {owned.item.assetPath ? (
                  <div className="relative aspect-video overflow-hidden bg-muted">
                    <img
                      src={owned.item.assetPath}
                      alt={owned.item.name}
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                ) : (
                  <div className={cn("flex aspect-video items-center justify-center text-3xl", rarity.bgColor)}>
                    {owned.item.type === "BANNER" ? "🖼️" : owned.item.type === "EMBLEM" ? "🛡️" : "✨"}
                  </div>
                )}
                <div className="p-2.5">
                  <p className="text-sm font-semibold">{owned.item.name}</p>
                  {owned.item.artistKey && (() => {
                    const artist = getArtist(owned.item.artistKey);
                    return artist ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {countryFlag(artist.country)} {artist.name}
                      </p>
                    ) : null;
                  })()}
                  <div className="mt-1.5 flex items-center justify-between">
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
