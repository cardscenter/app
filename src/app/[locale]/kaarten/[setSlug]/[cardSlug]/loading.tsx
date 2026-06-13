import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/layout/page-container";

// Instant laad-feedback bij navigatie naar een kaart (bv. vanaf een set-pagina).
// Zonder deze boundary blijft in de App Router de vórige pagina staan tot de
// server-render klaar is — dat voelt als "hangen". Layout spiegelt page.tsx:
// sticky kaartafbeelding links (lg:col-span-1) + metadata/prijs/listings rechts.
export default function CardDetailLoading() {
  return (
    <PageContainer width="default" className="py-8">
      {/* Breadcrumbs */}
      <div className="mb-4 flex gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-32" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left: card image */}
        <div className="lg:col-span-1">
          <div className="space-y-4 lg:sticky lg:top-20">
            <Skeleton className="aspect-[5/7] w-full rounded-2xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>

        {/* Right: metadata + pricing + listings */}
        <div className="space-y-6 lg:col-span-2">
          {/* Header */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-9 w-2/3" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
            </div>
          </div>

          {/* Pricing panel */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex justify-between">
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-24" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>

          {/* Sell CTA */}
          <Skeleton className="h-16 w-full rounded-xl" />

          {/* Listings section */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
