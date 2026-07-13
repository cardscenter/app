import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Heart } from "lucide-react";
import { RealtimePageRefresh } from "@/components/providers/realtime-page-refresh";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { StatusBadge, type StatusTone } from "@/components/dashboard/ui/status-badge";
import { buttonVariants } from "@/components/ui/button";

// Status → StatusBadge-tone. ACTIVE/LIVE = koopbaar, PARTIALLY_SOLD = deels,
// PAUSED/RESERVED = tijdelijk weg, DELETED = weg, rest = afgerond.
function statusTone(status: string): StatusTone {
  if (status === "ACTIVE" || status === "LIVE") return "success";
  if (status === "PARTIALLY_SOLD") return "info";
  if (status === "PAUSED" || status === "RESERVED") return "warning";
  if (status === "DELETED") return "danger";
  return "neutral";
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

function statusLabel(status: string): string {
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
      <RealtimePageRefresh events={["listing-changed", "auction-ended", "bid-placed"]} />
      <DashboardPageHeader title={t("title")} />

      {items.length === 0 ? (
        <EmptyState
          icon={Heart}
          title={t("empty")}
          action={
            <Link href="/marktplaats" className={buttonVariants({ size: "sm", variant: "outline" })}>
              Ontdek de marktplaats
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const target = item.auction ?? item.claimsale ?? item.listing;
            if (!target) return null;

            const type = item.auction ? "auction" : item.claimsale ? "claimsale" : "listing";
            const href = type === "auction"
              ? `/veilingen/${target.id}`
              : type === "claimsale"
                ? `/claimsales/${target.id}`
                : `/marktplaats/${target.id}`;

            const typeLabel = type === "auction" ? t("auction") : type === "claimsale" ? t("claimsale") : t("listing");
            const status = "status" in target ? target.status : "";
            const notBuyable = NOT_BUYABLE_STATUSES.has(status);

            return (
              <Link
                key={item.id}
                href={href}
                className={`flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover ${
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
                <StatusBadge tone={statusTone(status)}>{statusLabel(status)}</StatusBadge>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
