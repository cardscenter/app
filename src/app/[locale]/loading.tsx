import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <div className="flex flex-col">
      {/* Hero skeleton */}
      <div className="relative h-[480px] bg-gradient-to-br from-slate-800 to-slate-900">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="max-w-xl space-y-4">
            <Skeleton className="h-6 w-40 !bg-white/10" />
            <Skeleton className="h-6 w-48 !bg-white/10" />
            <Skeleton className="h-6 w-36 !bg-white/10" />
            <Skeleton className="mt-6 h-12 w-3/4 !bg-white/10" />
            <Skeleton className="h-12 w-2/3 !bg-white/10" />
            <Skeleton className="mt-4 h-5 w-full !bg-white/10" />
            <Skeleton className="mt-8 h-12 w-full !bg-white/10" />
          </div>
        </div>
      </div>

      {/* Stats strip skeleton */}
      <div className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0 divide-border">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 py-4 px-4 sm:py-5">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="space-y-1">
                  <Skeleton className="h-6 w-12" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Carousel sections skeleton */}
      {[1, 2, 3].map((section) => (
        <div key={section} className={`py-8 sm:py-12 ${section % 2 === 0 ? "section-gradient-alt border-t border-border" : "bg-background"}`}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-6">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-6 w-40" />
            </div>
            <div className="flex gap-4 overflow-hidden">
              {[1, 2, 3, 4].map((card) => (
                <div key={card} className="glass rounded-2xl overflow-hidden flex-shrink-0 w-[280px] sm:w-[calc(50%-8px)] lg:w-[calc(25%-12px)]">
                  <Skeleton className="w-full aspect-square rounded-none" />
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-5 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
