import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function MyAuctionsPage() {
  const session = await auth();
  const t = await getTranslations("dashboard");
  const ta = await getTranslations("auction");

  const auctions = await prisma.auction.findMany({
    where: { sellerId: session!.user!.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { bids: true } } },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {t("myAuctions")}
        </h1>
        <Link
          href="/veilingen/nieuw"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          + {ta("createTitle")}
        </Link>
      </div>

      {auctions.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">
          {t("noActiveAuctions")}
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {auctions.map((auction) => (
            <Link
              key={auction.id}
              href={`/veilingen/${auction.id}`}
              className="block rounded-lg border border-zinc-200 p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
                  {auction.title}
                </h3>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  auction.status === "ACTIVE"
                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    : auction.status === "ENDED_SOLD" || auction.status === "BOUGHT_NOW"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}>
                  {auction.status}
                </span>
              </div>
              <div className="mt-2 flex gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                <span>{ta("currentBid")}: €{(auction.currentBid ?? auction.startingBid).toFixed(2)}</span>
                <span>{auction._count.bids} biedingen</span>
                <span>{new Date(auction.endTime).toLocaleDateString("nl-NL")}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
