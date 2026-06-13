import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/layout/page-container";

// Laad-feedback bij navigatie naar een set-pagina (bv. vanaf de kaarten-lijst).
// Header + grid van kaart-thumbnails, spiegelt page.tsx (width="wide").
export default function SetDetailLoading() {
  return (
    <PageContainer width="wide" className="py-8">
      {/* Breadcrumbs */}
      <div className="mb-4 flex gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-28" />
      </div>

      {/* Header */}
      <div className="mb-6 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-[5/7] w-full rounded-xl" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
