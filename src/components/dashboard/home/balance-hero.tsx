import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowUpRight, Lock, Plus, ShieldCheck, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { BalanceOverview } from "@/lib/dashboard-queries";
import { PILL_RED } from "@/components/ploy/tile-styles";

// Donkere saldo-band bovenaan het dashboard (design-pass ronde G): cc-dark
// paneel met 20px radius, totaal saldo groot in de display-letter, drie
// sub-pills (beschikbaar / gereserveerd / escrow) met een pastel-icoon en de
// geld-acties rechts als pillen.

type Props = { balance: BalanceOverview };

export async function BalanceHero({ balance }: Props) {
  const t = await getTranslations("dashboard.home");
  const total = balance.available + balance.reserved;

  const pills = [
    { Icon: Wallet, label: t("available"), value: balance.available, tone: "text-[var(--pastel-green)]" },
    { Icon: Lock, label: t("reserved"), value: balance.reserved, tone: "text-[var(--pastel-blue)]" },
    { Icon: ShieldCheck, label: t("escrow"), value: balance.escrow, tone: "text-[var(--pastel-yellow)]" },
  ];

  return (
    <section className="relative overflow-hidden rounded-[20px] bg-[var(--cc-dark)] p-6 text-white sm:p-8">
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-white/70">{t("totalBalance")}</p>
          <p className="cc-display mt-1 text-[44px] leading-none tabular-nums sm:text-[56px]">{formatCurrency(total)}</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {pills.map(({ Icon, label, value, tone }) => (
              <li key={label} className="cc-pill inline-flex items-center gap-1.5 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90">
                <Icon className={`size-3.5 ${tone}`} />
                {label}
                <span className="font-semibold tabular-nums text-white">{formatCurrency(value)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/saldo" className={PILL_RED}>
            <Plus className="size-4" />
            {t("deposit")}
          </Link>
          <Link
            href="/dashboard/uitbetalingen"
            className="cc-pill inline-flex items-center justify-center gap-1.5 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
          >
            <ArrowUpRight className="size-4" />
            {t("withdraw")}
          </Link>
        </div>
      </div>
    </section>
  );
}
