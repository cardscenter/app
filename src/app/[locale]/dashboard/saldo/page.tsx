import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { AlertCircle, Receipt } from "lucide-react";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { BalanceSummary } from "@/components/dashboard/balance-summary";
import { DepositMethods } from "@/components/dashboard/deposit-methods";
import { DepositVerifyGate } from "@/components/dashboard/deposit-verify-gate";
import { PendingFeesBanner } from "@/components/dashboard/pending-fees-banner";
import { FinanceTabs } from "@/components/dashboard/cluster-tabs";

export default async function BalancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);
  const t = await getTranslations("wallet");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      balance: true,
      reservedBalance: true,
      heldBalance: true,
      bankTransferReference: true,
      emailVerifiedAt: true,
    },
  });

  const transactions = await prisma.transaction.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Openstaande veilingbetalingen: het volledige betaal-blok leeft sinds
  // Fase 44 alleen nog op /dashboard/aankopen (order-verplichting) — hier
  // volstaat een slanke alert-banner met doorverwijzing.
  const pendingAuctions = await prisma.auction.findMany({
    where: {
      winnerId: session.user.id,
      paymentStatus: "AWAITING_PAYMENT",
    },
    select: { id: true, finalPrice: true },
  });
  const pendingAuctionTotal =
    Math.round(pendingAuctions.reduce((s, a) => s + (a.finalPrice ?? 0), 0) * 100) / 100;

  if (!user) return null;

  return (
    <div className="space-y-6">
      <FinanceTabs />

      <PendingFeesBanner />

      {pendingAuctions.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />
            <div className="flex-1">
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                {pendingAuctions.length === 1
                  ? "1 veiling wacht op je betaling"
                  : `${pendingAuctions.length} veilingen wachten op je betaling`}{" "}
                — €{pendingAuctionTotal.toFixed(2)}
              </p>
              <Link
                href="/dashboard/aankopen"
                className="mt-1 inline-block text-sm font-medium text-amber-900 underline dark:text-amber-200"
              >
                Betaal via je aankopen →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Balance summary */}
      <BalanceSummary
        balance={user.balance}
        reservedBalance={user.reservedBalance}
        heldBalance={user.heldBalance}
      />

      {/* Deposit methods — verborgen tot e-mail bevestigd is (Fase 43),
          zodat de bankreferentie nooit aan onbevestigde accounts getoond
          wordt. */}
      {user.emailVerifiedAt ? (
        <DepositMethods
          bankTransferReference={user.bankTransferReference}
        />
      ) : (
        <DepositVerifyGate />
      )}

      {/* Transaction history */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {t("transactions")}
        </h2>

        {transactions.length === 0 ? (
          <EmptyState icon={Receipt} title={t("noTransactions")} compact />
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
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
