import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ListingCard } from "@/components/listing/listing-card";

export default async function DashboardMarktplaatsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const t = await getTranslations("listing");

  const listings = await prisma.listing.findMany({
    where: { sellerId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { seller: { select: { displayName: true } } },
  });

  const active = listings.filter((l) => l.status === "ACTIVE");
  const sold = listings.filter((l) => l.status === "SOLD");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t("myListings")}</h1>
        <Link
          href={`/${locale}/marktplaats/nieuw`}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-primary-hover hover:shadow-lg"
        >
          + {t("createTitle")}
        </Link>
      </div>

      {/* Active */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">{t("active")} ({active.length})</h2>
        {active.length === 0 ? (
          <div className="glass-subtle rounded-2xl p-6 text-center text-muted-foreground">
            {t("noListings")}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((listing) => (
              <ListingCard key={listing.id} listing={listing} locale={locale} />
            ))}
          </div>
        )}
      </div>

      {/* Sold */}
      {sold.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">{t("sold")} ({sold.length})</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sold.map((listing) => (
              <ListingCard key={listing.id} listing={listing} locale={locale} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
