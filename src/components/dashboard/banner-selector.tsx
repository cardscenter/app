"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { SELLER_LEVELS, getBannerUrl } from "@/lib/seller-levels";
import { updateProfileBanner } from "@/actions/profile";
import { Lock, Check, X } from "lucide-react";
import Image from "next/image";

type Props = {
  currentBanner: string | null;
  currentLevelIndex: number;
};

export function BannerSelector({ currentBanner, currentLevelIndex }: Props) {
  const t = useTranslations("profile");
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(currentBanner);
  const [isPending, startTransition] = useTransition();

  function handleSelect(nameKey: string, levelIndex: number) {
    if (levelIndex > currentLevelIndex) return; // locked
    if (selected === nameKey) {
      // Deselect
      setSelected(null);
      startTransition(async () => {
        const result = await updateProfileBanner(null);
        if (result.success) router.refresh();
      });
    } else {
      setSelected(nameKey);
      startTransition(async () => {
        const result = await updateProfileBanner(nameKey);
        if (result.success) router.refresh();
      });
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-2">{t("profileBanner")}</h2>
      <p className="text-sm text-muted-foreground mb-4">{t("bannerDescription")}</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {SELLER_LEVELS.map((level, index) => {
          const isLocked = index > currentLevelIndex;
          const isActive = selected === level.nameKey;

          return (
            <button
              key={level.nameKey}
              type="button"
              disabled={isPending || isLocked}
              onClick={() => handleSelect(level.nameKey, index)}
              className={`group relative overflow-hidden rounded-xl border-2 transition-all ${
                isActive
                  ? "border-primary ring-2 ring-primary/30"
                  : isLocked
                    ? "border-border opacity-60 cursor-not-allowed"
                    : "border-border hover:border-foreground/30"
              }`}
            >
              <div className="relative aspect-[21/9] w-full">
                <Image
                  src={getBannerUrl(level.nameKey)}
                  alt={level.name}
                  fill
                  className={`object-cover ${isLocked ? "grayscale blur-[1px]" : ""}`}
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                />

                {/* Lock overlay */}
                {isLocked && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Lock className="size-5 text-white" />
                  </div>
                )}

                {/* Active checkmark */}
                {isActive && (
                  <div className="absolute top-1.5 right-1.5 rounded-full bg-primary p-1">
                    <Check className="size-3 text-primary-foreground" />
                  </div>
                )}
              </div>

              {/* Label */}
              <div className="px-2 py-1.5 text-center">
                <span className={`text-xs font-medium ${isLocked ? "text-muted-foreground" : "text-foreground"}`}>
                  {level.icon} {level.name}
                </span>
                {isLocked && (
                  <p className="text-[10px] text-muted-foreground">
                    {level.minXP.toLocaleString()} XP
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <button
          type="button"
          onClick={() => {
            setSelected(null);
            startTransition(async () => {
              const result = await updateProfileBanner(null);
              if (result.success) router.refresh();
            });
          }}
          disabled={isPending}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/30"
        >
          <X className="size-3.5" />
          {t("removeBanner")}
        </button>
      )}
    </div>
  );
}
