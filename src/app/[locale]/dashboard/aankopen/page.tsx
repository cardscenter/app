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
      <h1 className="text-2xl font-bold text-foreground">
        {t("myPurchases")}
      </h1>

      {purchasedItems.length === 0 && wonAuctions.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          {t("noPurchases")}
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {wonAuctions.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground">Gewonnen Veilingen</h2>
              <div className="mt-3 space-y-3">
                {wonAuctions.map((a) => (
                  <div key={a.id} className="glass rounded-2xl p-4">
                    <p className="font-medium text-foreground">{a.title}</p>
                    <div className="mt-1 flex gap-4 text-sm text-muted-foreground">
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
              <h2 className="text-lg font-semibold text-foreground">Claimsale Aankopen</h2>
              <div className="mt-3 space-y-3">
                {purchasedItems.map((item) => (
                  <div key={item.id} className="glass rounded-2xl p-4">
                    <p className="font-medium text-foreground">{item.cardName}</p>
                    <div className="mt-1 flex gap-4 text-sm text-muted-foreground">
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
