import { searchAll, type SearchFilters } from "@/actions/search";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { SearchBar } from "@/components/search/search-bar";
import { SearchFilters as SearchFiltersPanel } from "@/components/search/search-filters";
import { SearchSortBar } from "@/components/search/search-sort-bar";
import { SearchResultCard } from "@/components/search/search-result-card";
import { SearchX } from "lucide-react";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const t = await getTranslations("search");

  const q = typeof params.q === "string" ? params.q : "";
  const type = typeof params.type === "string" ? params.type : undefined;
  const condition = typeof params.condition === "string" ? params.condition : undefined;
  const cardSetId = typeof params.cardSetId === "string" ? params.cardSetId : undefined;
  const minPrice = typeof params.minPrice === "string" ? parseFloat(params.minPrice) : undefined;
  const maxPrice = typeof params.maxPrice === "string" ? parseFloat(params.maxPrice) : undefined;
  const sort = typeof params.sort === "string" ? params.sort : "newest";

  const filters: SearchFilters = {
    q: q || undefined,
    type: type as SearchFilters["type"],
    condition,
    cardSetId,
    minPrice: minPrice && !isNaN(minPrice) ? minPrice : undefined,
    maxPrice: maxPrice && !isNaN(maxPrice) ? maxPrice : undefined,
    sort: sort as SearchFilters["sort"],
  };

  const [{ results, total }, cardSets] = await Promise.all([
    searchAll(filters),
    prisma.cardSet.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page header with search */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <div className="mt-4">
          <SearchBar variant="hero" defaultValue={q} />
        </div>
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        {/* Filter sidebar */}
        <SearchFiltersPanel cardSets={cardSets} />

        {/* Results */}
        <div className="flex-1">
          {/* Sort bar */}
          <SearchSortBar resultCount={total} query={q} />

          {/* Results grid */}
          {results.length > 0 ? (
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((result) => (
                <SearchResultCard key={`${result.type}-${result.id}`} result={result} />
              ))}
            </div>
          ) : (
            <div className="mt-16 flex flex-col items-center justify-center">
              <div className="rounded-full bg-secondary p-4">
                <SearchX className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="mt-4 text-sm font-medium text-foreground">
                {t("noResults", { query: q })}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("noResultsHint")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
