import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";

export default async function BalancePage() {
  const session = await auth();
  const t = await getTranslations("wallet");

  const user = await prisma.user.findUnique({
    where: { id: session!.user!.id },
  });

  const transactions = await prisma.transaction.findMany({
    where: { userId: session!.user!.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  if (!user) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        {t("balance")}
      </h1>

      {/* Balance card */}
      <div className="mt-6 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("balance")}</p>
        <p className="mt-2 text-4xl font-bold text-zinc-900 dark:text-zinc-50">
          €{user.balance.toFixed(2)}
        </p>
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          {t("minimumDeposit")}
        </p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t("depositInstructions")}
        </p>
      </div>

      {/* Transaction history */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {t("transactions")}
        </h2>

        {transactions.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            {t("noTransactions")}
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Datum</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Beschrijving</th>
                  <th className="px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400">Bedrag</th>
                  <th className="px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {new Date(tx.createdAt).toLocaleDateString("nl-NL")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                      {tx.description}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${tx.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {tx.amount >= 0 ? "+" : ""}€{tx.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-400">
                      €{tx.balanceAfter.toFixed(2)}
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
