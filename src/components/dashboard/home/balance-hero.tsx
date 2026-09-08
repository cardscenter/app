import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowUpRight, Lock, Plus, ShieldCheck, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { BalanceOverview } from "@/lib/dashboard-queries";

// Donkere saldo-band bovenaan het dashboard: totaal saldo groot, drie
// sub-pills (beschikbaar / gereserveerd / escrow) en de primaire geld-acties
// rechts. Altijd donker, in beide thema's. TailAdmin-pass (sept 2026):
// platter (6px radius, compacte padding), decoratie gedempt.

type Props = { balance: BalanceOverview };

export async function BalanceHero({ balance }: Props) {
  const t = await getTranslations("dashboard.home");
  const total = balance.available + balance.reserved;

  const pills = [
    { Icon: Wallet, label: t("available"), value: balance.available, tone: "text-emerald-300" },
    { Icon: Lock, label: t("reserved"), value: balance.reserved, tone: "text-sky-300" },
    { Icon: ShieldCheck, label: t("escrow"), value: balance.escrow, tone: "text-amber-300" },
  ];

  return (
    <section className="relative overflow-hidden rounded-dash bg-slate-950 p-5 text-white sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 80% at 100% 0%, rgba(37,99,235,0.28) 0%, transparent 60%), radial-gradient(40% 60% at 0% 100%, rgba(16,185,129,0.12) 0%, transparent 60%)",
        }}
      />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-white/70">{t("totalBalance")}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">
            {formatCurrency(total)}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {pills.map(({ Icon, label, value, tone }) => (
              <li
                key={label}
                className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-white/90 ring-1 ring-white/10"
              >
                <Icon className={`size-3.5 ${tone}`} />
                {label}
                <span className="tabular-nums text-white">{formatCurrency(value)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/saldo"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
          >
            <Plus className="size-4" />
            {t("deposit")}
          </Link>
          <Link
            href="/dashboard/uitbetalingen"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-white/10 px-4 text-sm font-semibold text-white ring-1 ring-white/15 transition-colors hover:bg-white/15"
          >
            <ArrowUpRight className="size-4" />
            {t("withdraw")}
          </Link>
        </div>
      </div>
    </section>
  );
}
