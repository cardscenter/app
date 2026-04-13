"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { Trophy } from "lucide-react";
import { EmberIcon } from "@/components/customization/ember-icon";
import { getPendingUnlocks, acknowledgeAllUnlocks } from "@/actions/achievements";

interface Props {
  isAuthenticated: boolean;
}

/**
 * Checks for unshown achievement-tier unlocks on mount and after navigation,
 * then fires a celebration toast for each and marks them acknowledged.
 *
 * Runs per logged-in user. Silent for guests.
 */
export function AchievementUnlockListener({ isAuthenticated }: Props) {
  const pathname = usePathname();
  const inFlight = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (inFlight.current) return;

    let cancelled = false;
    inFlight.current = true;

    (async () => {
      try {
        const pending = await getPendingUnlocks();
        if (cancelled || pending.length === 0) return;

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
            { duration: 5000 }
          );
        }

        await acknowledgeAllUnlocks();
      } finally {
        inFlight.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
    // Re-check on navigation so unlocks from server actions that revalidate
    // the page get surfaced as soon as the user lands somewhere.
  }, [isAuthenticated, pathname]);

  return null;
}
