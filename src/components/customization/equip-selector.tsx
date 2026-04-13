"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Check, Lock, X } from "lucide-react";
import { equipItem, unequipSlot } from "@/actions/customization";
import { getRarity } from "@/lib/cosmetic-config";
import { cn } from "@/lib/utils";

type LevelBanner = {
  key: string;
  name: string;
  icon: string;
  gradient: string;
  minXP: number;
  isUnlocked: boolean;
};

type OwnedCosmetic = {
  key: string;
  name: string;
  rarity: string;
  assetPath: string | null;
  bundleName: string;
};

type Tab = "banner" | "emblem" | "background";

interface EquipSelectorProps {
  currentBanner: string | null;
  currentEmblem: string | null;
  currentBackground: string | null;
  levelBanners: LevelBanner[];
  ownedBanners: OwnedCosmetic[];
  ownedEmblems: OwnedCosmetic[];
  ownedBackgrounds: OwnedCosmetic[];
  bundles: Array<{ id: string; key: string; name: string }>;
}

export function EquipSelector({
  currentBanner,
  currentEmblem,
  currentBackground,
  levelBanners,
  ownedBanners,
  ownedEmblems,
  ownedBackgrounds,
  bundles,
}: EquipSelectorProps) {
  const t = useTranslations("customization");
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("banner");
  const [bundleFilter, setBundleFilter] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  const currentEquipped = {
    banner: currentBanner,
    emblem: currentEmblem,
    background: currentBackground,
  };

  function handleEquip(itemKey: string, slot: Tab) {
    startTransition(async () => {
      await equipItem(itemKey, slot);
      router.refresh();
    });
  }

  function handleUnequip(slot: Tab) {
    startTransition(async () => {
      await unequipSlot(slot);
      router.refresh();
    });
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "banner", label: t("banners") },
    { key: "emblem", label: t("emblems") },
    { key: "background", label: t("backgrounds") },
  ];

  return (
    <div className={cn(isPending && "pointer-events-none opacity-50")}>
      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg bg-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setBundleFilter("all"); }}
            className={cn(
              "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Currently Equipped */}
      {currentEquipped[activeTab] && (
        <div className="mb-4 flex items-center justify-between rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2">
            <Check className="size-4 text-emerald-500" />
            <span className="text-sm">
              {t("equipped")}: <strong>{currentEquipped[activeTab]}</strong>
            </span>
          </div>
          <button
            onClick={() => handleUnequip(activeTab)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            <X className="size-3" />
            {t("unequip")}
          </button>
        </div>
      )}

      {/* Banner Tab */}
      {activeTab === "banner" && (
        <>
          {/* Bundle filter */}
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => setBundleFilter("all")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                bundleFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
              )}
            >
              {t("allBundles")}
            </button>
            <button
              onClick={() => setBundleFilter("level")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                bundleFilter === "level" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
              )}
            >
              {t("levelBanners")}
            </button>
            {bundles.map((bundle) => (
              <button
                key={bundle.id}
                onClick={() => setBundleFilter(bundle.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  bundleFilter === bundle.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                )}
              >
                {bundle.name}
              </button>
            ))}
          </div>

          {/* Level Banners */}
          {(bundleFilter === "all" || bundleFilter === "level") && (
            <div className="mb-6">
              {bundleFilter === "all" && (
                <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{t("levelBanners")}</h3>
              )}
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {levelBanners.map((banner) => {
                  const isEquipped = currentBanner === banner.key;
                  return (
                    <button
                      key={banner.key}
                      onClick={() => banner.isUnlocked && handleEquip(banner.key, "banner")}
                      disabled={!banner.isUnlocked}
                      className={cn(
                        "group relative overflow-hidden rounded-lg border-2 transition-all",
                        isEquipped ? "border-emerald-500 ring-2 ring-emerald-500/30" : "border-border hover:border-foreground/30",
                        !banner.isUnlocked && "cursor-not-allowed opacity-60"
                      )}
                    >
                      <div className={cn("aspect-[21/9] bg-gradient-to-br flex items-center justify-center", banner.gradient)}>
                        <span className="text-3xl opacity-40 select-none">{banner.icon}</span>
                      </div>
                      {!banner.isUnlocked && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <Lock className="size-5 text-white" />
                        </div>
                      )}
                      {isEquipped && (
                        <div className="absolute right-1 top-1 rounded-full bg-emerald-500 p-0.5">
                          <Check className="size-3 text-white" />
                        </div>
                      )}
                      <div className="p-1.5 text-center">
                        <span className="text-xs font-medium">{banner.icon} {banner.name}</span>
                        {!banner.isUnlocked && (
                          <p className="text-[10px] text-muted-foreground">{banner.minXP.toLocaleString()} XP</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Owned cosmetic banners */}
          {(bundleFilter === "all" || (bundleFilter !== "level" && bundleFilter !== "all")) && ownedBanners.length > 0 && (
            <div>
              {bundleFilter === "all" && (
                <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Cosmetic Banners</h3>
              )}
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {ownedBanners
                  .filter((b) => bundleFilter === "all" || bundleFilter === "level" || true)
                  .map((banner) => {
                    const rarity = getRarity(banner.rarity);
                    const isEquipped = currentBanner === banner.key;
                    return (
                      <button
                        key={banner.key}
                        onClick={() => handleEquip(banner.key, "banner")}
                        className={cn(
                          "group relative overflow-hidden rounded-lg border-2 transition-all",
                          isEquipped ? "border-emerald-500 ring-2 ring-emerald-500/30" : rarity.borderColor,
                          "hover:border-foreground/30"
                        )}
                      >
                        {banner.assetPath ? (
                          <div className="aspect-[21/9] bg-muted">
                            <img src={banner.assetPath} alt={banner.name} className="size-full object-cover" />
                          </div>
                        ) : (
                          <div className={cn("flex aspect-[21/9] items-center justify-center", rarity.bgColor)}>
                            🖼️
                          </div>
                        )}
                        {isEquipped && (
                          <div className="absolute right-1 top-1 rounded-full bg-emerald-500 p-0.5">
                            <Check className="size-3 text-white" />
                          </div>
                        )}
                        <div className="p-1.5">
                          <p className="text-xs font-medium line-clamp-1">{banner.name}</p>
                          <span className={cn("text-[10px] font-semibold", rarity.textColor)}>{rarity.label}</span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Emblem Tab */}
      {activeTab === "emblem" && (
        <CosmeticGrid
          items={ownedEmblems}
          equippedKey={currentEmblem}
          slot="emblem"
          onEquip={handleEquip}
          emptyMessage={t("noItems")}
          packsLink="/customization/packs"
          packsLabel={t("chapters")}
        />
      )}

      {/* Background Tab */}
      {activeTab === "background" && (
        <CosmeticGrid
          items={ownedBackgrounds}
          equippedKey={currentBackground}
          slot="background"
          onEquip={handleEquip}
          emptyMessage={t("noItems")}
          packsLink="/customization/packs"
          packsLabel={t("chapters")}
        />
      )}
    </div>
  );
}

function CosmeticGrid({
  items,
  equippedKey,
  slot,
  onEquip,
  emptyMessage,
  packsLink,
  packsLabel,
}: {
  items: OwnedCosmetic[];
  equippedKey: string | null;
  slot: Tab;
  onEquip: (key: string, slot: Tab) => void;
  emptyMessage: string;
  packsLink: string;
  packsLabel: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center">
        <p className="text-muted-foreground">{emptyMessage}</p>
        <a
          href={packsLink}
          className="mt-4 inline-flex items-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
        >
          {packsLabel}
        </a>
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {items.map((item) => {
        const rarity = getRarity(item.rarity);
        const isEquipped = equippedKey === item.key;
        return (
          <button
            key={item.key}
            onClick={() => onEquip(item.key, slot)}
            className={cn(
              "group relative overflow-hidden rounded-lg border-2 transition-all text-left",
              isEquipped ? "border-emerald-500 ring-2 ring-emerald-500/30" : rarity.borderColor,
              "hover:border-foreground/30"
            )}
          >
            {item.assetPath ? (
              <div className="aspect-square bg-muted">
                <img src={item.assetPath} alt={item.name} className="size-full object-cover" />
              </div>
            ) : (
              <div className={cn("flex aspect-square items-center justify-center text-3xl", rarity.bgColor)}>
                {slot === "emblem" ? "🛡️" : "✨"}
              </div>
            )}
            {isEquipped && (
              <div className="absolute right-1 top-1 rounded-full bg-emerald-500 p-0.5">
                <Check className="size-3 text-white" />
              </div>
            )}
            <div className="p-2">
              <p className="text-sm font-medium line-clamp-1">{item.name}</p>
              <div className="mt-1 flex items-center justify-between">
                <span className={cn("text-[10px] font-semibold", rarity.textColor)}>{rarity.label}</span>
                <span className="text-[10px] text-muted-foreground">{item.bundleName}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
