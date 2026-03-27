import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Clock, Plus } from "lucide-react";
import { AuctionCard } from "@/components/auction/auction-card";

export default async function AuctionsPage() {
  const t = await getTranslations("auction");
  const tc = await getTranslations("common");

  const auctions = await prisma.auction.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    include: {
      seller: { select: { displayName: true } },
      _count: { select: { bids: true } },
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {tc("auctions")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {auctions.length} {auctions.length === 1 ? "veiling" : "veilingen"} actief
          </p>
        </div>
        <Link
          href="/veilingen/nieuw"
          className="inline-flex items-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-md transition-all hover:bg-primary-hover hover:shadow-lg"
        >
          <Plus className="size-4 mr-1" />
          {t("createTitle")}
        </Link>
      </div>

      {auctions.length === 0 ? (
        <div className="mt-16 flex flex-col items-center justify-center">
          <div className="rounded-full bg-secondary p-4">
            <Clock className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{tc("noResults")}</p>
          <Link
            href="/veilingen/nieuw"
            className="mt-4 text-sm font-medium text-primary hover:text-primary-hover transition-colors"
          >
            {t("createTitle")} &rarr;
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {auctions.map((auction) => (
            <AuctionCard key={auction.id} auction={auction} />
          ))}
        </div>
      )}
    </div>
  );
}

