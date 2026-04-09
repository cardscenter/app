import { AuctionCardSkeleton } from "@/components/skeletons/auction-card-skeleton";
import { ClaimsaleCardSkeleton } from "@/components/skeletons/claimsale-card-skeleton";
import { ListingCardSkeleton } from "@/components/skeletons/listing-card-skeleton";

interface CardGridSkeletonProps {
  count?: number;
  type?: "auction" | "claimsale" | "listing";
}

export function CardGridSkeleton({ count = 8, type = "auction" }: CardGridSkeletonProps) {
  const CardSkeleton =
    type === "auction" ? AuctionCardSkeleton
    : type === "claimsale" ? ClaimsaleCardSkeleton
    : ListingCardSkeleton;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
