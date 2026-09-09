"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { followUser, unfollowUser } from "@/actions/follow";
import { cn } from "@/lib/utils";

type Props = {
  targetUserId: string;
  initiallyFollowing: boolean;
  /** Niet ingelogd → knop stuurt naar login met terugkeer naar dit profiel. */
  loggedIn: boolean;
  className?: string;
};

/**
 * Volg-knop op het publieke profiel (profiel-redesign sept 2026). Zwarte
 * primaire knop zoals in de referentie; gevolgd = outline met vinkje.
 * Optimistic toggle + router.refresh zodat de volgers-teller meeloopt.
 */
export function FollowButton({ targetUserId, initiallyFollowing, loggedIn, className }: Props) {
  const t = useTranslations("sellerProfile");
  const router = useRouter();
  const [following, setFollowing] = useState(initiallyFollowing);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (!loggedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/verkoper/${targetUserId}`)}`);
      return;
    }
    const next = !following;
    setFollowing(next);
    startTransition(async () => {
      const result = next ? await followUser(targetUserId) : await unfollowUser(targetUserId);
      if ("error" in result && result.error) {
        setFollowing(!next);
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={following}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-semibold transition-colors disabled:opacity-60",
        following
          ? "border border-border bg-card text-foreground hover:bg-muted"
          : "bg-foreground text-background hover:bg-foreground/85",
        className,
      )}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : following ? (
        <Check className="size-4" />
      ) : (
        <Plus className="size-4" />
      )}
      {following ? t("following") : t("follow")}
    </button>
  );
}
