import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowUpRight, Lock, Plus, ShieldCheck, Store, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { BalanceOverview } from "@/lib/dashboard-queries";

// Donkere saldo-band bovenaan het dashboard (naar de fintech-referentie):
// totaal saldo groot, drie sub-pills (beschikbaar / gereserveerd / escrow) en
// de primaire geld-acties rechts. Altijd donker, in beide thema's.

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
    <section className="relative overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-card sm:p-8">
      {/* Decoratie: zachte gloed + gedraaide tegels rechts, zoals de referentie */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 80% at 100% 0%, rgba(37,99,235,0.35) 0%, transparent 60%), radial-gradient(40% 60% at 0% 100%, rgba(16,185,129,0.18) 0%, transparent 60%)",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 hidden gap-4 opacity-[0.08] lg:grid lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <span key={i} className="size-24 rounded-3xl border-2 border-white/80 rotate-12" />
        ))}
      </div>

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-white/70">{t("totalBalance")}</p>
          <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight sm:text-5xl">
            {formatCurrency(total)}
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {pills.map(({ Icon, label, value, tone }) => (
              <li
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 ring-1 ring-white/10"
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
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
          >
            <Plus className="size-4" />
            {t("deposit")}
          </Link>
          <Link
            href="/dashboard/uitbetalingen"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-semibold text-white ring-1 ring-white/15 transition-colors hover:bg-white/15"
          >
            <ArrowUpRight className="size-4" />
            {t("withdraw")}
          </Link>
          <Link
            href="/marktplaats/nieuw"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-semibold text-white ring-1 ring-white/15 transition-colors hover:bg-white/15"
          >
            <Store className="size-4" />
            {t("newListing")}
          </Link>
        </div>
      </div>
    </section>
  );
}
