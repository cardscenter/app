import { Skeleton } from "@/components/ui/skeleton";
import { CardGridSkeleton } from "@/components/skeletons/card-grid-skeleton";
import { PageContainer } from "@/components/layout/page-container";

export default function AuctionsLoading() {
  return (
    <PageContainer width="wide" className="py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      {/* Sort bar */}
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Card grid */}
      <CardGridSkeleton count={12} type="auction" />
    </PageContainer>
  );
}
