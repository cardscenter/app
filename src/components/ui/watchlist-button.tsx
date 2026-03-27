"use client";

import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { useState } from "react";
import { toggleWatchlist } from "@/actions/watchlist";
import { useRouter } from "next/navigation";

interface WatchlistButtonProps {
  auctionId?: string;
  claimsaleId?: string;
  listingId?: string;
  initialWatched: boolean;
}

export function WatchlistButton({ auctionId, claimsaleId, listingId, initialWatched }: WatchlistButtonProps) {
  const [watched, setWatched] = useState(initialWatched);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleToggle() {
    setLoading(true);
    const target = auctionId
      ? { auctionId }
      : claimsaleId
        ? { claimsaleId }
        : { listingId: listingId! };

    const result = await toggleWatchlist(target);
    if ("watched" in result && result.watched !== undefined) {
      setWatched(result.watched);
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <motion.button
      onClick={handleToggle}
      disabled={loading}
      whileTap={{ scale: 0.9 }}
      className="rounded-full p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
      title={watched ? "Verwijderen van volglijst" : "Toevoegen aan volglijst"}
    >
      <motion.div
        animate={{
          scale: watched ? [1, 1.3, 1] : 1,
        }}
        transition={{
          duration: 0.3,
          ease: "easeInOut",
        }}
      >
        <Heart
          className={`h-6 w-6 transition-colors ${
            watched ? "fill-red-500 text-red-500" : "text-gray-400"
          }`}
        />
      </motion.div>
    </motion.button>
  );
}
