import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function WatchlistPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const t = await getTranslations("watchlist");

  const items = await prisma.watchlist.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      auction: { select: { id: true, title: true, currentBid: true, startingBid: true, endTime: true, status: true } },
      claimsale: { select: { id: true, title: true, status: true } },
      listing: { select: { id: true, title: true, price: true, pricingType: true, status: true } },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>

      {items.length === 0 ? (
        <div className="glass-subtle rounded-2xl p-8 text-center text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const target = item.auction ?? item.claimsale ?? item.listing;
            if (!target) return null;

            const type = item.auction ? "auction" : item.claimsale ? "claimsale" : "listing";
            const href = type === "auction"
              ? `/${locale}/veilingen/${target.id}`
              : type === "claimsale"
                ? `/${locale}/claimsales/${target.id}`
                : `/${locale}/marktplaats/${target.id}`;

            const typeLabel = type === "auction" ? t("auction") : type === "claimsale" ? t("claimsale") : t("listing");
            const status = "status" in target ? target.status : "";

            return (
              <Link
                key={item.id}
                href={href}
                className="glass-subtle flex items-center justify-between rounded-2xl p-4 transition-all hover:scale-[1.005] hover:shadow-md"
              >
                <div>
                  <span className="text-xs font-medium text-primary">{typeLabel}</span>
                  <h3 className="font-medium text-foreground">{target.title}</h3>
                  {"currentBid" in target && target.currentBid != null && (
                    <p className="text-sm text-muted-foreground">Huidig bod: €{(target.currentBid as number).toFixed(2)}</p>
                  )}
                  {"price" in target && target.price != null && (
                    <p className="text-sm text-muted-foreground">€{(target.price as number).toFixed(2)}</p>
                  )}
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  status === "ACTIVE" || status === "LIVE"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {status}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
