import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ShoppingBag, Plus } from "lucide-react";
import { ClaimsaleCard } from "@/components/claimsale/claimsale-card";

export default async function ClaimsalesPage() {
  const tc = await getTranslations("common");
  const t = await getTranslations("claimsale");

  const claimsales = await prisma.claimsale.findMany({
    where: { status: "LIVE" },
    orderBy: { publishedAt: "desc" },
    include: {
      seller: { select: { displayName: true } },
      _count: { select: { items: true } },
      items: { where: { status: "AVAILABLE" }, select: { id: true, price: true } },
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {tc("claimsales")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {claimsales.length} {claimsales.length === 1 ? "claimsale" : "claimsales"} actief
          </p>
        </div>
        <Link
          href="/claimsales/nieuw"
          className="inline-flex items-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-md transition-all hover:bg-primary-hover hover:shadow-lg"
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
            className="mt-4 text-sm font-medium text-primary hover:text-primary-hover transition-colors"
          >
            {t("createTitle")} &rarr;
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {claimsales.map((cs) => (
            <ClaimsaleCard key={cs.id} claimsale={cs} />
          ))}
        </div>
      )}
    </div>
  );
}
