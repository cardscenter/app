import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { WithdrawalForm } from "@/components/dashboard/withdrawal-form";
import { WithdrawalHistory } from "@/components/dashboard/withdrawal-history";
import { WITHDRAWAL_MIN_AMOUNT } from "@/lib/withdrawal-config";
import { maskIban } from "@/lib/validations/iban";

export default async function MyWithdrawalsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const t = await getTranslations("withdrawal");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      balance: true,
      reservedBalance: true,
      iban: true,
      accountHolderName: true,
    },
  });
  if (!user) return null;

  const requests = await prisma.withdrawalRequest.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  const activeRequest = requests.find((r) => r.status === "PENDING" || r.status === "APPROVED") ?? null;
  const available = Math.max(0, user.balance - user.reservedBalance);
  const hasBankDetails = !!user.iban && !!user.accountHolderName;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>

      <div className="glass rounded-xl p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-xs text-muted-foreground">{t("availableBalance")}</p>
            <p className="text-2xl font-bold text-foreground">€{available.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("ibanLabel")}</p>
            {hasBankDetails ? (
              <>
                <p className="font-mono text-sm text-foreground">{maskIban(user.iban!)}</p>
                <p className="text-xs text-muted-foreground">{user.accountHolderName}</p>
              </>
            ) : (
              <Link href="/dashboard/profiel" className="text-sm text-primary hover:underline">
                {t("setupBankDetails")}
              </Link>
            )}
          </div>
        </div>

        {hasBankDetails && (
          <WithdrawalForm
            available={available}
            minAmount={WITHDRAWAL_MIN_AMOUNT}
            disabled={activeRequest !== null}
            disabledReason={activeRequest ? t("hasActiveRequest") : null}
          />
        )}
      </div>

      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">{t("historyTitle")}</h2>
        <WithdrawalHistory
          requests={requests.map((r) => ({
            id: r.id,
            amount: r.amount,
            iban: r.iban,
            status: r.status,
            rejectReason: r.rejectReason,
            createdAt: r.createdAt.toISOString(),
            paidAt: r.paidAt?.toISOString() ?? null,
            rejectedAt: r.rejectedAt?.toISOString() ?? null,
          }))}
        />
      </div>
    </div>
  );
}
