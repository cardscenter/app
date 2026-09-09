import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { Scale, Clock, Hourglass, CheckCircle2, AlertTriangle, Zap } from "lucide-react";
import { hasFeature } from "@/lib/subscription-tiers";
import { TierPill } from "@/components/ui/tier-pill";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { StatCard } from "@/components/dashboard/ui/stat-card";
import { StatusBadge, type StatusTone } from "@/components/dashboard/ui/status-badge";
import {
  DISPUTE_V2_REASON_LABELS,
  DISPUTE_V2_STATUS_LABELS,
  DISPUTE_V2_RESOLUTION_LABELS,
  type DisputeV2ReasonCategory,
  type DisputeV2Resolution,
  type DisputeV2Status,
} from "@/lib/dispute-v2/config";

// Admin-wachtrij voor geschillen. Vier tabs zodat de beheerder op ELK moment
// kan meekijken (niet alleen na escalatie):
//   escalated → wacht op beslissing (SLA-volgorde)
//   active    → lopend tussen partijen (OPEN/SELLER_RESPONDED/MEDIATION) —
//               beheerder kan overnemen of direct beslissen
//   resolved  → afgerond (laatste 200)
//   all       → alles

type Tab = "escalated" | "active" | "resolved" | "all";
const TABS: { key: Tab; label: string }[] = [
  { key: "escalated", label: "Te beoordelen" },
  { key: "active", label: "Lopend" },
  { key: "resolved", label: "Afgerond" },
  { key: "all", label: "Alles" },
];

const STATUS_TONE: Record<string, StatusTone> = {
  OPEN: "warning",
  SELLER_RESPONDED: "info",
  MEDIATION: "primary",
  ESCALATED: "danger",
  RESOLVED_BUYER: "success",
  RESOLVED_SELLER: "neutral",
  RESOLVED_MUTUAL: "success",
  RESOLVED_ADMIN: "success",
  CANCELLED: "neutral",
};

// Buiten de component zodat de purity-lint (Date.now in render) niet aanslaat;
// server-pagina rendert per request, dus "nu" is per definitie vers.
const nowMs = () => Date.now();

const ACTIVE = ["OPEN", "SELLER_RESPONDED", "MEDIATION"] as const;
const RESOLVED = ["RESOLVED_BUYER", "RESOLVED_SELLER", "RESOLVED_MUTUAL", "RESOLVED_ADMIN", "CANCELLED"] as const;

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const tab: Tab = (["escalated", "active", "resolved", "all"] as const).includes(sp.tab as Tab) ? (sp.tab as Tab) : "escalated";
  const q = sp.q?.trim() ?? "";

  const where =
    tab === "escalated"
      ? { status: "ESCALATED" }
      : tab === "active"
        ? { status: { in: [...ACTIVE] } }
        : tab === "resolved"
          ? { status: { in: [...RESOLVED] } }
          : {};

  const searchWhere = q
    ? {
        OR: [
          { id: { contains: q } },
          { bundle: { orderNumber: { contains: q } } },
          { buyer: { displayName: { contains: q } } },
          { seller: { displayName: { contains: q } } },
        ],
      }
    : {};

  const [disputes, counts] = await Promise.all([
    prisma.disputeV2.findMany({
      where: { ...where, ...searchWhere },
      orderBy:
        tab === "escalated"
          ? [{ adminSLADeadline: "asc" }, { createdAt: "asc" }]
          : tab === "active"
            ? [{ buyerReviewDeadline: "asc" }, { responseDeadline: "asc" }]
            : [{ createdAt: "desc" }],
      take: 200,
      include: {
        buyer: { select: { id: true, displayName: true, accountType: true } },
        seller: { select: { id: true, displayName: true, accountType: true } },
        bundle: { select: { id: true, orderNumber: true, totalCost: true, refundedAmount: true } },
      },
    }),
    prisma.disputeV2.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  // Voorrang bij support en geschillen (tier-feature prioritySupport, Fase 45):
  // in "Te beoordelen" komen geschillen met een Unlimited+/Enterprise-partij
  // bovenaan. Array.sort is stabiel, dus de SLA-volgorde blijft binnen de groep.
  const isPriorityParty = (accountType: string) => hasFeature(accountType, "prioritySupport");
  const isPriority = (d: (typeof disputes)[number]) =>
    isPriorityParty(d.buyer.accountType) || isPriorityParty(d.seller.accountType);
  if (tab === "escalated") {
    disputes.sort((a, b) => Number(isPriority(b)) - Number(isPriority(a)));
  }
  const nPriority = tab === "escalated" ? disputes.filter(isPriority).length : 0;

  const countOf = (statuses: readonly string[]) =>
    counts.filter((c) => statuses.includes(c.status)).reduce((s, c) => s + c._count._all, 0);
  const nEscalated = countOf(["ESCALATED"]);
  const nActive = countOf(ACTIVE);
  const nResolved = countOf(RESOLVED);
  const now = nowMs();
  const nOverdue = disputes.filter((d) => d.status === "ESCALATED" && d.adminSLADeadline && d.adminSLADeadline.getTime() < now).length;

  const fmt = (d: Date) => d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Geschillen"
        subtitle="Eén wachtrij voor alle geschillen tussen kopers en verkopers. Je kunt elk lopend geschil op elk moment overnemen of direct beslissen; geëscaleerde geschillen hebben een SLA van 5 dagen."
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Te beoordelen" value={nEscalated} icon={Scale} iconClassName="bg-rose-500/10 text-rose-600 dark:text-rose-400" href="/dashboard/admin/disputes?tab=escalated" hint={[nOverdue > 0 ? `${nOverdue} over SLA` : null, nPriority > 0 ? `${nPriority} met voorrang` : null].filter(Boolean).join(" · ") || undefined} />
        <StatCard label="Lopend tussen partijen" value={nActive} icon={Hourglass} iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400" href="/dashboard/admin/disputes?tab=active" />
        <StatCard label="Afgerond" value={nResolved} icon={CheckCircle2} iconClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" href="/dashboard/admin/disputes?tab=resolved" />
        <StatCard label="Totaal" value={nEscalated + nActive + nResolved} icon={AlertTriangle} iconClassName="bg-muted text-muted-foreground" href="/dashboard/admin/disputes?tab=all" />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="inline-flex gap-1 dash-card p-1">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/dashboard/admin/disputes?tab=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t.key ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {t.key === "escalated" && nEscalated > 0 && (
                <span className="ml-1.5 rounded-full bg-rose-500/15 px-1.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">{nEscalated}</span>
              )}
            </Link>
          ))}
        </nav>
        <form className="flex items-center gap-2" action="/dashboard/admin/disputes">
          <input type="hidden" name="tab" value={tab} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Zoek op ordernummer, naam of id"
            className="glass-input w-64 px-3 py-1.5 text-sm text-foreground"
          />
          <button className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50">Zoek</button>
        </form>
      </div>

      {disputes.length === 0 ? (
        <EmptyState icon={Scale} title={tab === "escalated" ? "Geen geschillen die op een beslissing wachten." : "Geen geschillen in deze lijst."} compact />
      ) : (
        <div className="dash-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Geschil</th>
                <th className="px-4 py-3 text-left">Partijen</th>
                <th className="px-4 py-3 text-left">Reden</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Termijn</th>
                <th className="px-4 py-3 text-right">Bedrag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {disputes.map((d) => {
                const remaining = d.bundle.totalCost - (d.bundle.refundedAmount ?? 0);
                let deadline: { label: string; tone: StatusTone } | null = null;
                if (d.status === "ESCALATED" && d.adminSLADeadline) {
                  const ms = d.adminSLADeadline.getTime() - now;
                  const days = Math.ceil(ms / 86_400_000);
                  deadline = ms < 0 ? { label: `SLA verstreken (${Math.abs(days)}d)`, tone: "danger" } : { label: `SLA ${days}d`, tone: days <= 2 ? "warning" : "info" };
                } else if (d.status === "OPEN") {
                  deadline = { label: `verkoper tot ${fmt(d.responseDeadline)}`, tone: d.responseDeadline.getTime() < now ? "danger" : "neutral" };
                } else if ((d.status === "SELLER_RESPONDED" || d.status === "MEDIATION") && d.buyerReviewDeadline) {
                  deadline = { label: `${d.status === "MEDIATION" ? "voorstel" : "koper"} tot ${fmt(d.buyerReviewDeadline)}`, tone: d.buyerReviewDeadline.getTime() < now ? "danger" : "neutral" };
                } else if (d.resolvedAt) {
                  deadline = { label: `afgerond ${fmt(d.resolvedAt)}`, tone: "neutral" };
                }
                return (
                  <tr key={d.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/geschillen/${d.id}`} className="font-medium text-primary hover:underline">
                        {d.bundle.orderNumber}
                      </Link>
                      <p className="font-mono text-[11px] text-muted-foreground">{d.id.slice(0, 8)} · {fmt(d.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="flex flex-wrap items-center gap-1.5 text-foreground">
                        <span>{d.buyer.displayName}</span>
                        {isPriorityParty(d.buyer.accountType) && <TierPill accountType={d.buyer.accountType} />}
                        <span className="text-muted-foreground">vs</span>
                        <span>{d.seller.displayName}</span>
                        {isPriorityParty(d.seller.accountType) && <TierPill accountType={d.seller.accountType} />}
                      </p>
                      {isPriority(d) && (
                        <div className="mt-1">
                          <StatusBadge tone="primary" icon={Zap}>Voorrang</StatusBadge>
                        </div>
                      )}
                      {d.fundingSource === "SELLER_BALANCE" && (
                        <p className="text-[11px] text-muted-foreground">na ontvangst · uit verkoperssaldo</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {DISPUTE_V2_REASON_LABELS[d.reasonCategory as DisputeV2ReasonCategory] ?? d.reasonCategory}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={STATUS_TONE[d.status] ?? "neutral"}>{DISPUTE_V2_STATUS_LABELS[d.status as DisputeV2Status] ?? d.status}</StatusBadge>
                      {d.resolution && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {DISPUTE_V2_RESOLUTION_LABELS[d.resolution as DisputeV2Resolution] ?? d.resolution}
                          {d.finalRefund ? ` · €${d.finalRefund.toFixed(2)}` : ""}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {deadline && <StatusBadge tone={deadline.tone} icon={Clock}>{deadline.label}</StatusBadge>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <p className="font-semibold text-foreground">&euro;{remaining.toFixed(2)}</p>
                      {(d.bundle.refundedAmount ?? 0) > 0 && (
                        <p className="text-[11px] text-muted-foreground">van &euro;{d.bundle.totalCost.toFixed(2)}</p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
