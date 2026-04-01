import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ShoppingBag, Plus } from "lucide-react";
import { ClaimsaleCard } from "@/components/claimsale/claimsale-card";
import { Pagination } from "@/components/ui/pagination";

const PAGE_SIZE = 40;

export default async function ClaimsalesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const tc = await getTranslations("common");
  const t = await getTranslations("claimsale");

  const currentPage = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const totalCount = await prisma.claimsale.count({
    where: { status: "LIVE" },
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const claimsales = await prisma.claimsale.findMany({
    where: { status: "LIVE" },
    orderBy: { publishedAt: "desc" },
    skip: (safePage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      seller: { select: { displayName: true } },
      _count: { select: { items: true } },
      items: { where: { status: "AVAILABLE" }, select: { id: true, price: true } },
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("browseTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("activeCount", { count: totalCount })}
          </p>
        </div>
        <Link
          href="/claimsales/nieuw"
          className="inline-flex items-center rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-amber-700 hover:shadow-lg"
        >
          <Plus className="size-4 mr-1" />
          {t("createTitle")}
        </Link>
      </div>

      {claimsales.length === 0 ? (
        <div className="mt-16 flex flex-col items-center justify-center">
          <div className="rounded-full bg-secondary p-4">
            <ShoppingBag className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{tc("noResults")}</p>
          <Link
            href="/claimsales/nieuw"
            className="mt-4 text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors"
          >
            {t("createTitle")} &rarr;
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {claimsales.map((cs) => (
              <ClaimsaleCard key={cs.id} claimsale={cs} />
            ))}
          </div>

          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            baseUrl="/claimsales"
            locale={locale}
          />
        </>
      )}
    </div>
  );
}
