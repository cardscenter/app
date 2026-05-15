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

  async function handleToggle(e: React.MouseEvent<HTMLButtonElement>) {
    // De button kan in een nested <Link> staan (bv. op auction-card); zonder
    // preventDefault navigeert die mee. stopPropagation voorkomt dat bubble-
    // handlers op parent-Links de click oppakken.
    e.preventDefault();
    e.stopPropagation();
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

  // Veilingen landen op de Live Hub; listings + claimsales landen op de
  // Volglijst (zelfde watchlist-tabel onder de motorkap, maar twee verschillende
  // pagina's in het dashboard). Tooltip past zich aan zodat de gebruiker weet
  // waar het ding naartoe gaat.
  const destination = auctionId ? "Live Hub" : "Volglijst";

  return (
    <motion.button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      whileTap={{ scale: 0.9 }}
      className="rounded-full p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
      title={watched ? `Verwijderen van ${destination}` : `Toevoegen aan ${destination}`}
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
