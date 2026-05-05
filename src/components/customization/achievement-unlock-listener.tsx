"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { Trophy } from "lucide-react";
import { EmberIcon } from "@/components/customization/ember-icon";
import { getPendingUnlocks, acknowledgeAllUnlocks } from "@/actions/achievements";
import { useRealtime } from "@/components/providers/realtime-provider";

interface Props {
  isAuthenticated: boolean;
}

/**
 * Toont rich celebration-toasts voor unshown achievement-tier unlocks.
 *
 * Twee triggers (Fase 30A):
 *   1. Real-time SSE-event `achievement-unlocked` — verschijnt direct na grant,
 *      zonder navigatie of polling-tick.
 *   2. Mount + pathname-change — fallback voor disconnected SSE en voor
 *      unlocks die offline zijn gegrant.
 *
 * Beide paden roepen dezelfde flow aan: getPendingUnlocks → toast per unlock
 * → acknowledgeAllUnlocks. inFlight-guard voorkomt dubbele toasts als beide
 * triggers binnen ms van elkaar firen.
 */
export function AchievementUnlockListener({ isAuthenticated }: Props) {
  const pathname = usePathname();
  const inFlight = useRef(false);
  const { subscribe } = useRealtime();

  const showPendingUnlocks = useCallback(async () => {
    if (!isAuthenticated) return;
    if (inFlight.current) return;
    inFlight.current = true;

    try {
      const pending = await getPendingUnlocks();
      if (pending.length === 0) return;

      for (const unlock of pending) {
        toast.custom(
          () => (
            <div className="flex w-[360px] items-start gap-3 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-background to-background p-4 shadow-lg ring-1 ring-amber-500/20">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 ring-1 ring-amber-500/30">
                <Trophy className="size-5 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-500">
                  Tier {unlock.tier}/{unlock.maxTier} ontgrendeld
                </p>
                <p className="mt-0.5 text-sm font-bold text-foreground truncate">
                  {unlock.achievementName}
                </p>
                <div className="mt-1 flex items-center gap-3 text-xs">
                  {unlock.rewardEmber > 0 && (
                    <span className="flex items-center gap-1 font-semibold text-orange-500">
                      <EmberIcon className="size-3" />
                      +{unlock.rewardEmber.toLocaleString("nl-NL")}
                    </span>
                  )}
                  {unlock.rewardXP > 0 && (
                    <span className="font-semibold text-purple-500">
                      +{unlock.rewardXP} XP
                    </span>
                  )}
                </div>
              </div>
            </div>
          ),
          { duration: 5000 },
        );
      }

      await acknowledgeAllUnlocks();
    } finally {
      inFlight.current = false;
    }
  }, [isAuthenticated]);

  // Fallback: mount + navigation-change.
  useEffect(() => {
    showPendingUnlocks();
  }, [pathname, showPendingUnlocks]);

  // Real-time: SSE achievement-unlocked event triggert dezelfde flow direct.
  useEffect(() => {
    if (!isAuthenticated) return;
    return subscribe("achievement-unlocked", () => {
      showPendingUnlocks();
    });
  }, [isAuthenticated, subscribe, showPendingUnlocks]);

  return null;
}
