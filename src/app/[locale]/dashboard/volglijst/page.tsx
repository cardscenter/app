import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

// Mappt een status-string naar een kleur-bucket. ACTIVE/LIVE = koopbaar (groen),
// PARTIALLY_SOLD = deels koopbaar (blauw), PAUSED = tijdelijk weg (geel),
// SOLD/CANCELLED/CLOSED/ENDED = afgerond (grijs), DELETED = weg (rood).
function statusBadgeClass(status: string): string {
  if (status === "ACTIVE" || status === "LIVE") {
    return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  }
  if (status === "PARTIALLY_SOLD") {
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
  }
  if (status === "PAUSED" || status === "RESERVED") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
  }
  if (status === "DELETED") {
    return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300";
  }
  // SOLD, CANCELLED, CLOSED, ENDED — afgehandeld
  return "bg-muted text-muted-foreground";
}

const NOT_BUYABLE_STATUSES = new Set([
  "SOLD",
  "CANCELLED",
  "CLOSED",
  "ENDED",
  "DELETED",
  "PAUSED",
  "RESERVED",
]);

function statusLabel(status: string, type: "auction" | "claimsale" | "listing"): string {
  // Vertalingen liggen in verschillende namespaces; voor nu een simpele
  // NL-mapping zodat de badge altijd leesbaar is. Gangbare labels.
  const labels: Record<string, string> = {
    ACTIVE: "Actief",
    LIVE: "Live",
    PARTIALLY_SOLD: "Gedeeltelijk verkocht",
    PAUSED: "Gepauzeerd",
    RESERVED: "Gereserveerd",
    SOLD: "Verkocht",
    CANCELLED: "Geannuleerd",
    CLOSED: "Gesloten",
    ENDED: "Afgelopen",
    DELETED: "Verwijderd",
  };
  return labels[status] ?? status;
}

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
            const notBuyable = NOT_BUYABLE_STATUSES.has(status);

            return (
              <Link
                key={item.id}
                href={href}
                className={`glass-subtle flex items-center justify-between rounded-2xl p-4 transition-all hover:scale-[1.005] hover:shadow-md ${
                  notBuyable ? "opacity-70" : ""
                }`}
              >
                <div>
                  <span className="text-xs font-medium text-primary">{typeLabel}</span>
                  <h3 className={`font-medium text-foreground ${notBuyable ? "line-through" : ""}`}>{target.title}</h3>
                  {"currentBid" in target && target.currentBid != null && (
                    <p className="text-sm text-muted-foreground">Huidig bod: €{(target.currentBid as number).toFixed(2)}</p>
                  )}
                  {"price" in target && target.price != null && (
                    <p className="text-sm text-muted-foreground">€{(target.price as number).toFixed(2)}</p>
                  )}
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(status)}`}>
                  {statusLabel(status, type)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
