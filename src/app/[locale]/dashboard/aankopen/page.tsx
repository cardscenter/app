import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";

export default async function MyPurchasesPage() {
  const session = await auth();
  const t = await getTranslations("dashboard");

  const purchasedItems = await prisma.claimsaleItem.findMany({
    where: { buyerId: session!.user!.id, status: "SOLD" },
    orderBy: { updatedAt: "desc" },
    include: {
      claimsale: { include: { seller: { select: { displayName: true } } } },
      shippingBundle: true,
    },
  });

  const wonAuctions = await prisma.auction.findMany({
    where: { winnerId: session!.user!.id, status: { in: ["ENDED_SOLD", "BOUGHT_NOW"] } },
    orderBy: { updatedAt: "desc" },
    include: { seller: { select: { displayName: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        {t("myPurchases")}
      </h1>

      {purchasedItems.length === 0 && wonAuctions.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">
          {t("noPurchases")}
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {wonAuctions.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Gewonnen Veilingen</h2>
              <div className="mt-3 space-y-3">
                {wonAuctions.map((a) => (
                  <div key={a.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">{a.title}</p>
                    <div className="mt-1 flex gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                      <span>€{a.finalPrice?.toFixed(2)}</span>
                      <span>Verkoper: {a.seller.displayName}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {purchasedItems.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Claimsale Aankopen</h2>
              <div className="mt-3 space-y-3">
                {purchasedItems.map((item) => (
                  <div key={item.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">{item.cardName}</p>
                    <div className="mt-1 flex gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                      <span>€{item.price.toFixed(2)}</span>
                      <span>Verkoper: {item.claimsale.seller.displayName}</span>
                      <span>{item.condition}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
