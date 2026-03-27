import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { ListingCard } from "@/components/listing/listing-card";
import Link from "next/link";

export default async function MarktplaatsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("listing");

  const listings = await prisma.listing.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    include: {
      seller: { select: { displayName: true } },
      upsells: { where: { expiresAt: { gt: new Date() } }, select: { type: true, expiresAt: true } },
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-foreground">{t("browseTitle")}</h1>
        <Link
          href={`/${locale}/marktplaats/nieuw`}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-primary-hover hover:shadow-lg"
        >
          + {t("createTitle")}
        </Link>
      </div>

      {listings.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <p className="text-muted-foreground">{t("noListings")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
