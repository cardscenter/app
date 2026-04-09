import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { BalanceSummary } from "@/components/dashboard/balance-summary";
import { DepositMethods } from "@/components/dashboard/deposit-methods";
import { PendingAuctionPayments } from "@/components/dashboard/pending-auction-payments";

export default async function BalancePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const t = await getTranslations("wallet");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      balance: true,
      reservedBalance: true,
      heldBalance: true,
      bankTransferReference: true,
    },
  });

  const transactions = await prisma.transaction.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Check for auctions awaiting payment
  const pendingAuctions = await prisma.auction.findMany({
    where: {
      winnerId: session.user.id,
      paymentStatus: "AWAITING_PAYMENT",
    },
    select: {
      id: true,
      title: true,
      finalPrice: true,
      paymentDeadline: true,
    },
  });

  if (!user) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">
        {t("balance")}
      </h1>

      {/* Balance summary */}
      <div className="mt-6">
        <BalanceSummary
          balance={user.balance}
          reservedBalance={user.reservedBalance}
          heldBalance={user.heldBalance}
        />
      </div>

      {/* Pending auction payments */}
      {pendingAuctions.length > 0 && (
        <div className="mt-6">
          <PendingAuctionPayments
            auctions={pendingAuctions.map((a) => ({
              id: a.id,
              title: a.title,
              finalPrice: a.finalPrice,
              paymentDeadline: a.paymentDeadline,
            }))}
          />
        </div>
      )}

      {/* Deposit methods */}
      <div className="mt-6">
        <DepositMethods
          bankTransferReference={user.bankTransferReference}
        />
      </div>

      {/* Transaction history */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">
          {t("transactions")}
        </h2>

        {transactions.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {t("noTransactions")}
          </p>
        ) : (
          <div className="mt-4 overflow-hidden glass rounded-2xl">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("date")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("type")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("description")}</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t("amount")}</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t("balanceColumn")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString("nl-NL")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {tx.description}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${tx.amount >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {tx.amount >= 0 ? "+" : ""}&euro;{tx.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      &euro;{tx.balanceAfter.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
