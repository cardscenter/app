import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EquipSelector } from "@/components/customization/equip-selector";
import { SELLER_LEVELS, calculateXP, getBannerUrl } from "@/lib/seller-levels";

export default async function EquipPage() {
  const t = await getTranslations("customization");
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      profileBanner: true,
      profileEmblem: true,
      profileBackground: true,
      bonusXP: true,
      createdAt: true,
    },
  });

  if (!user) redirect("/auth/login");

  // Get user's XP for level banner unlocks
  const { getSellerStats } = await import("@/actions/review");
  const stats = await getSellerStats(session.user.id);
  const currentXP = stats?.xp ?? 0;

  // Get owned cosmetic items
  const ownedItems = await prisma.ownedItem.findMany({
    where: { userId: session.user.id },
    include: {
      item: {
        include: { bundle: { select: { id: true, key: true, name: true } } },
      },
    },
  });

  // Get all cosmetic bundles for the filter
  const bundles = await prisma.cosmeticBundle.findMany({
    where: { isActive: true },
    select: { id: true, key: true, name: true },
    orderBy: { sortOrder: "asc" },
  });

  // Build level banners data
  const levelBanners = SELLER_LEVELS.map((level) => ({
    key: level.nameKey,
    name: level.name,
    icon: level.icon,
    bannerUrl: getBannerUrl(level.nameKey),
    minXP: level.minXP,
    isUnlocked: currentXP >= level.minXP,
  }));

  // Build owned items grouped by type
  const ownedBanners = ownedItems.filter((o) => o.item.type === "BANNER");
  const ownedEmblems = ownedItems.filter((o) => o.item.type === "EMBLEM");
  const ownedBackgrounds = ownedItems.filter((o) => o.item.type === "BACKGROUND");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/customization" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{t("equipTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("equipSubtitle")}</p>
        </div>
      </div>

      <EquipSelector
        currentBanner={user.profileBanner}
        currentEmblem={user.profileEmblem}
        currentBackground={user.profileBackground}
        levelBanners={levelBanners}
        ownedBanners={ownedBanners.map((o) => ({
          key: o.item.key,
          name: o.item.name,
          rarity: o.item.rarity,
          assetPath: o.item.assetPath,
          bundleName: o.item.bundle.name,
        }))}
        ownedEmblems={ownedEmblems.map((o) => ({
          key: o.item.key,
          name: o.item.name,
          rarity: o.item.rarity,
          assetPath: o.item.assetPath,
          bundleName: o.item.bundle.name,
        }))}
        ownedBackgrounds={ownedBackgrounds.map((o) => ({
          key: o.item.key,
          name: o.item.name,
          rarity: o.item.rarity,
          assetPath: o.item.assetPath,
          bundleName: o.item.bundle.name,
        }))}
        bundles={bundles}
      />
    </div>
  );
}
