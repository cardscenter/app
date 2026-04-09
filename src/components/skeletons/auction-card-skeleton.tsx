import { Skeleton } from "@/components/ui/skeleton";

export function AuctionCardSkeleton() {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Image area */}
      <div className="flex flex-row sm:flex-col">
        <Skeleton className="w-24 h-32 sm:w-full sm:h-0 sm:pb-[100%] rounded-none" />
        <div className="flex-1 p-3 sm:p-4 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    </div>
  );
}
