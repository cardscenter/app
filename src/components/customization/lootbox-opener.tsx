"use client";

import { useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { EmberIcon } from "@/components/customization/ember-icon";
import { openLootbox, recycleDuplicate } from "@/actions/customization";
import { getRarity } from "@/lib/cosmetic-config";
import { cn } from "@/lib/utils";

type CarouselItem = {
  id: string;
  key: string;
  name: string;
  rarity: string;
  assetPath: string | null;
};

type ResultItem = CarouselItem & {
  type: string;
  rewardValue: number | null;
};

type Phase = "IDLE" | "SPINNING" | "REVEALING";

interface LootboxOpenerProps {
  lootboxId: string;
  lootboxName: string;
  emberCost: number;
  previewItems: Array<{
    id: string;
    key: string;
    name: string;
    rarity: string;
    type: string;
    assetPath: string | null;
  }>;
  currentBalance: number;
  isLoggedIn: boolean;
}

const ITEM_WIDTH = 140; // px per carousel slot
const ITEM_GAP = 8;
const SLOT_WIDTH = ITEM_WIDTH + ITEM_GAP;

export function LootboxOpener({
  lootboxId,
  lootboxName,
  emberCost,
  previewItems,
  currentBalance,
  isLoggedIn,
}: LootboxOpenerProps) {
  const t = useTranslations("customization");
  const router = useRouter();
  const stripRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<Phase>("IDLE");
  const [carousel, setCarousel] = useState<CarouselItem[]>([]);
  const [resultItem, setResultItem] = useState<ResultItem | null>(null);
  const [wasDuplicate, setWasDuplicate] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [balance, setBalance] = useState(currentBalance);
  const [lootboxCost, setLootboxCost] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recycleResult, setRecycleResult] = useState<string | null>(null);

  const canAfford = balance >= emberCost;

  const handleOpen = useCallback(async () => {
    if (!isLoggedIn || !canAfford || phase !== "IDLE") return;
    setError(null);
    setRecycleResult(null);

    const result = await openLootbox(lootboxId);
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }

    if (!("success" in result) || !result.success) return;

    setCarousel(result.carouselItems);
    setResultItem(result.resultItem as ResultItem);
    setWasDuplicate(result.wasDuplicate);
    setOpeningId(result.openingId);
    setBalance(result.newEmberBalance);
    setLootboxCost(result.lootboxCost);
    setPhase("SPINNING");

    // Start animation after next render
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (stripRef.current) {
          // Calculate target position: center the result item
          const resultIdx = result.resultIndex;
          const containerWidth = stripRef.current.parentElement?.clientWidth ?? 600;
          const targetOffset = resultIdx * SLOT_WIDTH - containerWidth / 2 + ITEM_WIDTH / 2;

          stripRef.current.style.transition = "transform 5s cubic-bezier(0.15, 0.85, 0.35, 1)";
          stripRef.current.style.transform = `translateX(-${targetOffset}px)`;
        }
      });
    });

    // Reveal after animation
    setTimeout(() => {
      setPhase("REVEALING");
    }, 5200);
  }, [lootboxId, isLoggedIn, canAfford, phase]);

  const handleRecycle = async (choice: "XP" | "EMBER") => {
    if (!openingId) return;
    const result = await recycleDuplicate(openingId, choice);
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    if ("xpAwarded" in result) {
      setRecycleResult(`+${result.xpAwarded} XP`);
    } else if ("emberRefund" in result) {
      setBalance((b) => b + (result.emberRefund ?? 0));
      setRecycleResult(`+${result.emberRefund} Ember`);
    }
  };

  const handleReset = () => {
    setPhase("IDLE");
    setCarousel([]);
    setResultItem(null);
    setWasDuplicate(false);
    setOpeningId(null);
    setRecycleResult(null);
    if (stripRef.current) {
      stripRef.current.style.transition = "none";
      stripRef.current.style.transform = "translateX(0)";
    }
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Spinner Container */}
      <div className="relative overflow-hidden rounded-lg border bg-card">
        {/* Center pointer */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-0.5 -translate-x-1/2 bg-orange-500" />
        <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2">
          <div className="size-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-orange-500" />
        </div>

        {/* Carousel strip */}
        <div className="relative h-44 overflow-hidden">
          {phase === "IDLE" && carousel.length === 0 ? (
            // Preview: show random sample of items
            <div className="flex h-full items-center justify-center gap-2 p-4">
              {previewItems.slice(0, 6).map((item, i) => {
                const rarity = getRarity(item.rarity);
                return (
                  <div
                    key={`${item.id}-${i}`}
                    className={cn(
                      "flex h-32 w-[120px] shrink-0 flex-col items-center justify-center rounded-lg border-2 bg-muted/50 p-2",
                      rarity.borderColor
                    )}
                  >
                    {item.assetPath ? (
                      <img src={item.assetPath} alt={item.name} className="mb-1 h-16 w-full rounded object-cover" />
                    ) : (
                      <div className={cn("mb-1 flex h-16 w-full items-center justify-center rounded text-2xl", rarity.bgColor)}>
                        ?
                      </div>
                    )}
                    <p className="line-clamp-1 text-xs font-medium">{item.name}</p>
                    <span className={cn("text-[10px] font-semibold", rarity.textColor)}>{rarity.label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              ref={stripRef}
              className="absolute left-0 top-1/2 flex -translate-y-1/2 gap-2"
              style={{ willChange: "transform" }}
            >
              {carousel.map((item, i) => {
                const rarity = getRarity(item.rarity);
                const isResult = phase === "REVEALING" && resultItem && item.id === resultItem.id && i === Math.floor(carousel.length * 0.8);
                return (
                  <div
                    key={`${item.id}-${i}`}
                    className={cn(
                      "flex h-32 shrink-0 flex-col items-center justify-center rounded-lg border-2 bg-muted/50 p-2 transition-shadow",
                      rarity.borderColor,
                      isResult && "ring-2 ring-orange-500 shadow-lg",
                    )}
                    style={{ width: ITEM_WIDTH }}
                  >
                    {item.assetPath ? (
                      <img src={item.assetPath} alt={item.name} className="mb-1 h-16 w-full rounded object-cover" />
                    ) : (
                      <div className={cn("mb-1 flex h-16 w-full items-center justify-center rounded text-2xl", rarity.bgColor)}>
                        ?
                      </div>
                    )}
                    <p className="line-clamp-1 text-xs font-medium">{item.name}</p>
                    <span className={cn("text-[10px] font-semibold", rarity.textColor)}>{rarity.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Result Area */}
      {phase === "REVEALING" && resultItem && (
        <div className="rounded-lg border bg-card p-6 text-center">
          {wasDuplicate ? (
            <>
              <p className="mb-2 text-lg font-bold text-yellow-500">{t("duplicate")}</p>
              <p className="mb-1 text-sm text-muted-foreground">{t("duplicateDesc")}</p>
              <div className="my-4">
                <div className={cn("mx-auto inline-flex items-center gap-2 rounded-lg border-2 px-4 py-2", getRarity(resultItem.rarity).borderColor)}>
                  <span className="font-semibold">{resultItem.name}</span>
                  <span className={cn("text-sm font-semibold", getRarity(resultItem.rarity).textColor)}>
                    {getRarity(resultItem.rarity).label}
                  </span>
                </div>
              </div>
              {recycleResult ? (
                <p className="text-lg font-bold text-emerald-500">{recycleResult}</p>
              ) : (
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => handleRecycle("XP")}
                    className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
                  >
                    {t("recycleForXP", { amount: 5 })}
                  </button>
                  <button
                    onClick={() => handleRecycle("EMBER")}
                    className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
                  >
                    {t("recycleForEmber", { amount: Math.floor(lootboxCost * getRarity(resultItem.rarity).recycleRate) })}
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="mb-2 text-lg font-bold text-emerald-500">{t("newItem")}</p>
              <div className="my-4">
                <div className={cn("mx-auto inline-flex items-center gap-2 rounded-lg border-2 px-4 py-2", getRarity(resultItem.rarity).borderColor)}>
                  <span className="font-semibold">{resultItem.name}</span>
                  <span className={cn("text-sm font-semibold", getRarity(resultItem.rarity).textColor)}>
                    {getRarity(resultItem.rarity).label}
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{t("addedToInventory")}</p>
            </>
          )}

          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={handleReset}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
            >
              {t("openAnother")}
            </button>
            <a
              href="/customization/inventory"
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              {t("viewInventory")}
            </a>
          </div>
        </div>
      )}

      {/* Open Button */}
      {phase === "IDLE" && (
        <div className="text-center">
          {!isLoggedIn ? (
            <p className="text-muted-foreground">{t("loginToOpen")}</p>
          ) : (
            <>
              <button
                onClick={handleOpen}
                disabled={!canAfford}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-8 py-3 text-lg font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <EmberIcon className="size-5" />
                {t("openPack")} — {emberCost} Ember
              </button>
              {!canAfford && (
                <p className="mt-2 text-sm text-red-500">{t("insufficientBalance")}</p>
              )}
            </>
          )}
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        </div>
      )}

      {phase === "SPINNING" && (
        <div className="text-center">
          <p className="animate-pulse text-lg font-medium text-orange-500">{t("spinning")}</p>
        </div>
      )}
    </div>
  );
}
