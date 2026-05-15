import { AlertCircle } from "lucide-react";
import { auth } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { getOpenPendingFees } from "@/lib/pending-fees";

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function PendingFeesBanner() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const open = await getOpenPendingFees(session.user.id);
  if (open.length === 0) return null;

  const total = round2(open.reduce((sum, f) => sum + f.amount, 0));

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />
        <div className="flex-1">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            Openstaande platformkosten: €{total.toFixed(2)}
          </p>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
            Door eerdere wanbetalingen staan er nog veilingkosten/borg open. Deze worden
            automatisch verrekend bij je volgende inkomst (deposit, verkoop, accept van
            een runner-up-aanbod).
          </p>
          <Link
            href="/dashboard/saldo/openstaande-kosten"
            className="mt-2 inline-block text-sm font-medium text-amber-900 underline dark:text-amber-200"
          >
            Bekijk specificatie →
          </Link>
        </div>
      </div>
    </div>
  );
}
