"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleCardWatchlist } from "@/actions/card-watchlist";
import { cn } from "@/lib/utils";

interface Props {
  cardId: string;
  initialWatching: boolean;
}

export function CardWatchlistButton({ cardId, initialWatching }: Props) {
  const [watching, setWatching] = useState(initialWatching);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const previous = watching;
      setWatching(!previous); // optimistic
      const result = await toggleCardWatchlist(cardId);
      if ("error" in result) {
        setWatching(previous);
        return;
      }
      setWatching(result.watching);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={cn(
        "glass-subtle group flex w-full items-center justify-between gap-3 rounded-xl p-4 text-left transition-all hover:ring-2 hover:ring-red-500/30 disabled:opacity-50",
        watching && "ring-2 ring-red-500/40 bg-red-500/5"
      )}
    >
      <div>
        <p className="font-semibold text-foreground">
          {watching ? "Op je watchlist" : "Volg deze kaart"}
        </p>
        <p className="text-xs text-muted-foreground">
          {watching
            ? "Klik om te stoppen met volgen."
            : "Krijg een melding zodra iemand deze kaart aanbiedt op Cards Center."}
        </p>
      </div>
      <Heart
        className={cn(
          "size-6 shrink-0 transition-all",
          watching ? "fill-red-500 text-red-500" : "text-muted-foreground group-hover:text-red-500"
        )}
      />
    </button>
  );
}
