"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { EmberIcon } from "@/components/customization/ember-icon";
import { claimDailyLogin } from "@/actions/customization";
import { LOGIN_STREAK_MILESTONES, LOGIN_STREAK_POST_MAX } from "@/lib/cosmetic-config";
import { cn } from "@/lib/utils";
import { Check, Gift, ChevronLeft, ChevronRight, Trophy } from "lucide-react";

interface LoginStreakProps {
  currentStreak: number;
  nextStreak: number;
  nextReward: number;
  alreadyClaimed: boolean;
  rewards: number[];
}

const ITEM_W = 72;
const GAP = 8;

export function LoginStreak({
  currentStreak,
  nextStreak,
  nextReward,
  alreadyClaimed: initialClaimed,
  rewards,
}: LoginStreakProps) {
  const t = useTranslations("customization");
  const router = useRouter();
  const [claimed, setClaimed] = useState(initialClaimed);
  const [claimedReward, setClaimedReward] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeDay = claimed ? currentStreak : nextStreak;

  // Scroll to active day on mount
  useEffect(() => {
    if (!scrollRef.current) return;
    const target = (activeDay - 1) * (ITEM_W + GAP);
    const container = scrollRef.current;
    const center = target - container.clientWidth / 2 + ITEM_W / 2;
    container.scrollTo({ left: Math.max(0, center), behavior: "smooth" });
  }, [activeDay]);

  function handleClaim() {
    startTransition(async () => {
      const result = await claimDailyLogin();
      if ("success" in result && result.success) {
        setClaimed(true);
        setClaimedReward(result.reward);
        router.refresh();
      }
    });
  }

  function scroll(dir: "left" | "right") {
    if (!scrollRef.current) return;
    const amount = (ITEM_W + GAP) * 4;
    scrollRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  }

  return (
    <div className="glass rounded-2xl p-5">
      {/* Header + claim button */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-bold">{t("loginStreak")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("loginStreakDesc")}
            {currentStreak > 0 && (
              <span className="ml-2 font-semibold text-orange-500">
                {currentStreak} {currentStreak === 1 ? t("day") : t("days")}
              </span>
            )}
          </p>
        </div>
        {claimed ? (
          claimedReward ? (
            <div className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-500 ring-1 ring-emerald-500/20">
              <Check className="size-4" />
              +{claimedReward} Ember
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-xl bg-muted px-4 py-2 text-sm font-medium text-muted-foreground">
              <Check className="size-4" />
              {t("loginClaimed")}
            </div>
          )
        ) : (
          <button
            onClick={handleClaim}
            disabled={isPending}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition-all hover:shadow-orange-500/40 hover:brightness-110 disabled:opacity-50"
          >
            <Gift className="size-4" />
            {isPending ? "..." : t("claimReward", { amount: nextReward })}
          </button>
        )}
      </div>

      {/* Carousel */}
      <div className="relative">
        {/* Scroll buttons */}
        <button
          onClick={() => scroll("left")}
          className="absolute -left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/80 p-1 shadow-md ring-1 ring-border backdrop-blur-sm transition-all hover:bg-background"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          onClick={() => scroll("right")}
          className="absolute -right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/80 p-1 shadow-md ring-1 ring-border backdrop-blur-sm transition-all hover:bg-background"
        >
          <ChevronRight className="size-4" />
        </button>

        {/* Edge fades */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-8 bg-gradient-to-r from-[var(--glass-bg,rgba(255,255,255,0.65))] to-transparent dark:from-[rgba(30,41,59,0.6)]" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-8 bg-gradient-to-l from-[var(--glass-bg,rgba(255,255,255,0.65))] to-transparent dark:from-[rgba(30,41,59,0.6)]" />

        {/* Scrollable strip */}
        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto px-4 py-1 scrollbar-none"
          style={{ scrollbarWidth: "none" }}
        >
          {rewards.map((reward, i) => {
            const dayNum = i + 1;
            const isMilestone = LOGIN_STREAK_MILESTONES.has(dayNum);
            const isCompleted = dayNum <= currentStreak;
            const isCurrent = dayNum === activeDay && claimed;
            const isNext = dayNum === nextStreak && !claimed;

            return (
              <div
                key={dayNum}
                className={cn(
                  "relative flex shrink-0 flex-col items-center justify-center rounded-xl py-2.5 transition-all",
                  // Milestone golden glow
                  isMilestone && !isCompleted && !isCurrent && "bg-yellow-500/10 ring-2 ring-yellow-500/40 shadow-[0_0_12px_rgba(234,179,8,0.15)]",
                  // Completed
                  isCompleted && !isMilestone && "bg-emerald-500/10 ring-1 ring-emerald-500/25",
                  isCompleted && isMilestone && "bg-emerald-500/15 ring-2 ring-emerald-500/40",
                  // Current (just claimed)
                  isCurrent && !isMilestone && "bg-emerald-500/15 ring-2 ring-emerald-500/50",
                  isCurrent && isMilestone && "bg-emerald-500/20 ring-2 ring-emerald-500/60",
                  // Next to claim
                  isNext && !isMilestone && "bg-orange-500/10 ring-2 ring-orange-400/50 animate-pulse",
                  isNext && isMilestone && "bg-gradient-to-b from-yellow-500/15 to-orange-500/15 ring-2 ring-yellow-400/60 animate-pulse shadow-[0_0_16px_rgba(234,179,8,0.25)]",
                  // Future normal
                  !isCompleted && !isCurrent && !isNext && !isMilestone && "bg-muted/30 ring-1 ring-border/30",
                )}
                style={{ width: ITEM_W }}
              >
                {/* Day label */}
                <span className="text-[10px] font-medium text-muted-foreground">
                  {t("day")} {dayNum}
                </span>

                {/* Icon + amount on same line */}
                <div className="mt-1 flex items-center gap-1">
                  {isCompleted || isCurrent ? (
                    <Check className="size-3.5 text-emerald-500" />
                  ) : (
                    <EmberIcon className="size-3.5" />
                  )}
                  <span className={cn(
                    "text-sm font-bold",
                    isCompleted || isCurrent
                      ? "text-emerald-500"
                      : isNext
                        ? "text-orange-400"
                        : isMilestone
                          ? "text-yellow-500"
                          : "text-muted-foreground"
                  )}>
                    {reward}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Day 29+ indicator */}
          <div
            className="flex shrink-0 flex-col items-center justify-center rounded-xl bg-muted/20 ring-1 ring-border/20 py-2.5"
            style={{ width: ITEM_W }}
          >
            <span className="text-[10px] font-medium text-muted-foreground">29+</span>
            <div className="mt-1 flex items-center gap-1">
              <EmberIcon className="size-3.5" />
              <span className="text-sm font-bold text-muted-foreground">{LOGIN_STREAK_POST_MAX}</span>
            </div>
          </div>
        </div>
      </div>

      {/* After day 28 banner */}
      {currentStreak >= 28 && (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-orange-500/10 p-2.5 text-sm font-medium text-orange-500 ring-1 ring-orange-500/20">
          <Trophy className="size-4" />
          {t("loginStreakMax", { amount: LOGIN_STREAK_POST_MAX })}
        </div>
      )}
    </div>
  );
}
