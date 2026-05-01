import { Skeleton } from "@/components/ui/skeleton";
import { CardGridSkeleton } from "@/components/skeletons/card-grid-skeleton";
import { PageContainer } from "@/components/layout/page-container";

export default function ClaimsalesLoading() {
  return (
    <PageContainer width="wide" className="py-8">
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <CardGridSkeleton count={12} type="claimsale" />
    </PageContainer>
  );
}
