import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { ShieldCheck, Ban, AlertCircle, Inbox } from "lucide-react";
import { isUserSuspended } from "@/lib/suspension";
import { maskIban, formatIbanForDisplay } from "@/lib/validations/iban";
import { decryptIban } from "@/lib/iban-crypto";
import { UserActionBar } from "@/components/admin/user-action-bar";
import { InternalNoteForm } from "@/components/admin/internal-note-form";
import { BidDepositExemptionToggle } from "@/components/admin/bid-deposit-exemption-toggle";
import { ReserveBreakdownCard } from "@/components/admin/reserve-breakdown-card";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { StatCard } from "@/components/dashboard/ui/stat-card";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { TierPill } from "@/components/ui/tier-pill";
import { UserRoleSelect } from "@/components/admin/user-role-select";
import { ageOn, isMinor } from "@/lib/age";
import { parseFavoriteGames } from "@/lib/games";
import { TABLE_HEAD } from "@/components/ploy/tile-styles";

const USER_DETAIL_SELECT = {
  id: true, displayName: true, email: true, firstName: true, lastName: true,
  bio: true, avatarUrl: true, accountType: true, accountKind: true,
  premiumExpiresAt: true, tierRank: true, searchBoost: true,
  freeUpsellsRemaining: true, freeUpsellsResetAt: true, shopSlug: true,
  companyName: true, vatNumber: true, cocNumber: true,
  isVerified: true, verificationStatus: true,
  balance: true, heldBalance: true, reservedBalance: true,
  emberBalance: true, bonusXP: true, loginStreak: true,
  bankTransferReference: true, iban: true, accountHolderName: true,
  lastIbanChange: true, lastUsernameChange: true, fullNameLockedAt: true, internalNote: true,
  suspendedUntil: true, suspensionType: true, suspensionReason: true, suspensionAdminId: true,
  street: true, houseNumber: true, postalCode: true, city: true, country: true,
  sellingCountries: true, maxRunnerUpAttempts: true,
  paymentFailureCount: true, paymentFailureLastAt: true, isBusinessBidExempt: true,
  lastLoginIp: true, lastLoginIpAt: true,
  // Community Hub (Fase 2)
  role: true, dateOfBirth: true, favoriteGames: true, guardianName: true, guardianEmail: true,
  guardianPhone: true, guardianConsentAt: true, newsletterOptIn: true, deletedAt: true,
  createdAt: true, updatedAt: true,
} satisfies Prisma.UserSelect;
type UserDetailPayload = Prisma.UserGetPayload<{ select: typeof USER_DETAIL_SELECT }>;

const TABS = [
  { key: "profile", label: "Profiel" },
  { key: "wallet", label: "Saldo & Transacties" },
  { key: "sales", label: "Sales" },
  { key: "purchases", label: "Aankopen" },
  { key: "disputes", label: "Disputes" },
  { key: "withdrawals", label: "Withdrawals" },
  { key: "reports", label: "Rapporten" },
  { key: "suspensions", label: "Suspensions" },
  { key: "reviews", label: "Reviews" },
  { key: "ember", label: "Ember & XP" },
  { key: "audit", label: "Audit" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function AdminUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { userId } = await params;
  const { tab: tabParam } = await searchParams;
  const tab: TabKey = (TABS.find((t) => t.key === tabParam)?.key ?? "profile") as TabKey;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: USER_DETAIL_SELECT,
  });

  if (!user) notFound();

  const activeSubscription = await prisma.subscription.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    select: { tier: true, billingCycle: true, monthlyPrice: true, yearlyPrice: true, startsAt: true, expiresAt: true, paymentStatus: true },
  });

  const suspended = isUserSuspended(user);

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={user.displayName}
        subtitle={user.email}
        backHref="/dashboard/admin/users"
        backLabel="Terug naar users"
        action={
          <UserActionBar
            userId={user.id}
            userName={user.displayName}
            accountType={user.accountType}
            isSuspended={suspended}
            hasIban={!!user.iban}
            hasUsernameCooldown={!!user.lastUsernameChange}
            firstName={user.firstName}
            lastName={user.lastName}
          />
        }
      />

      {/* Identiteits-kaart: avatar + status-pills */}
      <div className="flex items-center gap-4 dash-card p-4">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="h-14 w-14 shrink-0 rounded-[22%] object-cover" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22%] bg-primary text-xl font-bold text-primary-foreground">
            {user.displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
            {user.accountType}
          </code>
          <TierPill accountType={user.accountType} size="md" />
          {user.isVerified ? (
            <StatusBadge tone="success" icon={ShieldCheck}>Geverifieerd</StatusBadge>
          ) : (
            <StatusBadge tone="neutral" icon={AlertCircle}>Ongeverifieerd</StatusBadge>
          )}
          {suspended && (
            <StatusBadge tone="danger" icon={Ban}>
              {user.suspensionType === "PERMANENT" ? "Permanent geschorst" : `Geschorst tot ${user.suspendedUntil?.toLocaleDateString("nl-NL")}`}
            </StatusBadge>
          )}
        </div>
      </div>

      {/* Fase 5: interne notitie (moderatie) */}
      <InternalNoteForm userId={user.id} initial={user.internalNote} />

      {/* Tab nav */}
      <nav className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={{
                pathname: `/dashboard/admin/users/${user.id}`,
                query: { tab: t.key },
              }}
              className={
                active
                  ? "cc-pill inline-flex h-9 items-center px-4 text-sm font-semibold whitespace-nowrap bg-foreground text-white"
                  : "cc-pill inline-flex h-9 items-center px-4 text-sm font-semibold whitespace-nowrap bg-white text-foreground/70 transition-colors hover:text-foreground"
              }
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {/* Tab content */}
      <section className="dash-card p-5">
        {tab === "profile" && <ProfileTab user={user} subscription={activeSubscription} />}
        {tab === "wallet" && <WalletTab userId={user.id} userName={user.displayName} balance={user.balance} held={user.heldBalance} reserved={user.reservedBalance} />}
        {tab === "sales" && <SalesTab userId={user.id} />}
        {tab === "purchases" && <PurchasesTab userId={user.id} />}
        {tab === "disputes" && <DisputesTab userId={user.id} />}
        {tab === "withdrawals" && <WithdrawalsTab userId={user.id} />}
        {tab === "reports" && <ReportsTab userId={user.id} />}
        {tab === "suspensions" && <SuspensionsTab userId={user.id} />}
        {tab === "reviews" && <ReviewsTab userId={user.id} />}
        {tab === "ember" && <EmberTab userId={user.id} ember={user.emberBalance} bonusXP={user.bonusXP} loginStreak={user.loginStreak} />}
        {tab === "audit" && <AuditTab userId={user.id} />}
      </section>
    </div>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value || <span className="text-muted-foreground">-</span>}</dd>
    </div>
  );
}

type ActiveSubscription = {
  tier: string;
  billingCycle: string;
  monthlyPrice: number;
  yearlyPrice: number | null;
  startsAt: Date;
  expiresAt: Date;
  paymentStatus: string;
} | null;

function ProfileTab({ user, subscription }: { user: UserDetailPayload; subscription: ActiveSubscription }) {
  const fmtDate = (d: Date | null | undefined) => d?.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
      <Field label="ID" value={<code className="text-xs">{user.id}</code>} />
      <Field label="Rol" value={<UserRoleSelect userId={user.id} current={user.role} isAdminAccount={user.accountType === "ADMIN"} />} />
      <Field label="Leeftijd" value={user.dateOfBirth ? `${ageOn(user.dateOfBirth)} jaar${isMinor(user.dateOfBirth) ? " (minderjarig)" : ""}` : null} />
      <Field
        label="Ouder-toestemming"
        value={
          user.dateOfBirth && isMinor(user.dateOfBirth)
            ? user.guardianConsentAt
              ? `gegeven op ${user.guardianConsentAt.toLocaleString("nl-NL")}`
              : "nog niet gegeven"
            : null
        }
      />
      <Field label="Ouder / noodcontact" value={[user.guardianName, user.guardianEmail, user.guardianPhone].filter(Boolean).join(" · ")} />
      <Field label="Favoriete spellen" value={parseFavoriteGames(user.favoriteGames).join(", ")} />
      <Field label="Nieuwsbrief" value={user.newsletterOptIn ? "aangemeld" : "niet aangemeld"} />
      {user.deletedAt && <Field label="Verwijderd op" value={user.deletedAt.toLocaleString("nl-NL")} />}
      <Field label="Voornaam" value={user.firstName} />
      <Field label="Achternaam" value={user.lastName} />
      <Field label="Bio" value={user.bio} />
      <Field label="Account kind" value={user.accountKind} />
      <Field label="Bedrijf" value={user.companyName} />
      <Field label="BTW-nummer" value={user.vatNumber} />
      <Field label="KVK" value={user.cocNumber} />
      <Field label="Adres" value={[user.street, user.houseNumber, user.postalCode, user.city, user.country].filter(Boolean).join(" ")} />
      <Field label="Selling countries" value={user.sellingCountries} />
      <Field label="Verificatiestatus" value={user.verificationStatus} />
      <Field label="Bank reference" value={user.bankTransferReference ? <code className="text-xs">{user.bankTransferReference}</code> : null} />
      <Field
        label="IBAN"
        value={user.iban ? formatIbanForDisplay(decryptIban(user.iban)!) + " (" + maskIban(decryptIban(user.iban)!) + ")" : null}
      />
      <Field label="Op naam van" value={user.accountHolderName} />
      <Field label="Laatste IBAN-wijziging" value={user.lastIbanChange?.toLocaleString("nl-NL")} />
      <Field label="Naamswijziging verbruikt op" value={user.lastUsernameChange?.toLocaleString("nl-NL")} />
      <Field label="Volledige naam vastgezet op" value={user.fullNameLockedAt?.toLocaleString("nl-NL")} />
      <Field label="Max runner-up attempts" value={user.maxRunnerUpAttempts} />
      <Field label="Aangemaakt" value={user.createdAt?.toLocaleString("nl-NL")} />
      <Field label="Laatst bijgewerkt" value={user.updatedAt?.toLocaleString("nl-NL")} />
      {user.suspensionReason && <Field label="Suspension reden" value={user.suspensionReason} />}

      {/* Fase 45: abonnement / tier-status */}
      <div className="md:col-span-3 mt-2 rounded-[14px] bg-[var(--background)] p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Abonnement
        </h3>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-3">
          <Field
            label="Tier"
            value={
              <span className="inline-flex items-center gap-2">
                <code className="text-xs">{user.accountType}</code>
                <TierPill accountType={user.accountType} />
              </span>
            }
          />
          <Field label="Verloopt op" value={fmtDate(user.premiumExpiresAt)} />
          <Field
            label="Zoekboost"
            value={
              user.searchBoost ? (
                <StatusBadge tone="success">Actief</StatusBadge>
              ) : (
                <span className="text-muted-foreground">Niet actief</span>
              )
            }
          />
          <Field
            label="Gratis spotlights resterend"
            value={`${user.freeUpsellsRemaining}${user.freeUpsellsResetAt ? ` · reset ${fmtDate(user.freeUpsellsResetAt)}` : ""}`}
          />
          <Field label="Winkel-URL" value={user.shopSlug ? <code className="text-xs">/winkel/{user.shopSlug}</code> : null} />
          <Field label="tierRank (informatief)" value={user.tierRank} />
          <Field
            label="Actieve Subscription"
            value={
              subscription
                ? `${subscription.tier} · ${subscription.billingCycle === "YEARLY" ? "jaarlijks" : "maandelijks"} · €${subscription.monthlyPrice.toFixed(2)}/m · ${fmtDate(subscription.startsAt)} → ${fmtDate(subscription.expiresAt)} · ${subscription.paymentStatus}`
                : null
            }
          />
        </dl>
      </div>

      {/* Fase 29: veiling-status — strikes, borg-vrijstelling, IP-tracking */}
      <div className="md:col-span-3 mt-2 rounded-[14px] bg-[var(--background)] p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Veiling-status (Fase 29)
        </h3>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-3">
          <Field
            label="Wanbetalingen (strikes)"
            value={
              user.paymentFailureCount > 0 ? (
                <span className={user.paymentFailureCount >= 2 ? "font-semibold text-destructive" : "font-semibold text-[var(--pastel-yellow-ink)]"}>
                  {user.paymentFailureCount}× wanbetaling
                </span>
              ) : (
                <span className="text-[var(--pastel-green-ink)]">Geen</span>
              )
            }
          />
          <Field label="Laatste wanbetaling" value={user.paymentFailureLastAt?.toLocaleString("nl-NL")} />
          <Field
            label="Borg-vrijstelling"
            value={
              user.isBusinessBidExempt ? (
                <StatusBadge tone="success">Actief</StatusBadge>
              ) : (
                <span className="text-muted-foreground">Niet vrijgesteld</span>
              )
            }
          />
          <Field
            label="Laatste login-IP"
            value={user.lastLoginIp ? <code className="text-xs">{user.lastLoginIp}</code> : null}
          />
          <Field label="Login-IP geupdate" value={user.lastLoginIpAt?.toLocaleString("nl-NL")} />
        </dl>
        {/* Toggle voor BUSINESS-accounts — INDIVIDUAL ziet de knop niet */}
        {user.accountKind === "BUSINESS" && user.vatNumber && user.cocNumber && (
          <div className="mt-4 border-t border-border pt-4">
            <BidDepositExemptionToggle
              userId={user.id}
              userName={user.displayName}
              currentlyExempt={user.isBusinessBidExempt}
            />
          </div>
        )}
      </div>
    </dl>
  );
}

async function WalletTab({ userId, userName, balance, held, reserved }: { userId: string; userName: string; balance: number; held: number; reserved: number }) {
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Balance" value={`€${balance.toFixed(2)}`} tone="green" />
        <StatCard label="Beschikbaar" value={`€${(balance - reserved).toFixed(2)}`} tone="blue" />
        <StatCard label="Held (escrow)" value={`€${held.toFixed(2)}`} tone="yellow" />
        <StatCard label="Reserved" value={`€${reserved.toFixed(2)}`} tone="pink" />
      </div>

      <ReserveBreakdownCard userId={userId} userName={userName} />

      <DashboardSection variant="plain" title="Laatste 100 transacties">
        {transactions.length === 0 ? (
          <EmptyState icon={Inbox} title="Geen transacties." compact />
        ) : (
          <div className="overflow-x-auto dash-card">
            <table className="w-full text-sm">
              <thead className={`${TABLE_HEAD} bg-[var(--background)]`}>
                <tr>
                  <th className="px-4 py-2.5">Tijd</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5 text-right">Bedrag</th>
                  <th className="px-4 py-2.5 text-right">Saldo na</th>
                  <th className="px-4 py-2.5">Beschrijving</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-[var(--background)]">
                    <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {t.createdAt.toLocaleString("nl-NL")}
                    </td>
                    <td className="px-4 py-3"><code className="text-xs">{t.type}</code></td>
                    <td className={`px-4 py-3 text-right tabular-nums ${t.amount >= 0 ? "text-[var(--pastel-green-ink)]" : "text-destructive"}`}>
                      €{t.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">€{t.balanceAfter.toFixed(2)}</td>
                    <td className="px-4 py-3 text-xs">{t.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardSection>
    </div>
  );
}

async function SalesTab({ userId }: { userId: string }) {
  const [auctions, listings, claimsales] = await Promise.all([
    prisma.auction.findMany({ where: { sellerId: userId }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, title: true, status: true, startingBid: true, currentBid: true, createdAt: true } }),
    prisma.listing.findMany({ where: { sellerId: userId }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, title: true, status: true, price: true, createdAt: true } }),
    prisma.claimsale.findMany({ where: { sellerId: userId }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, title: true, status: true, createdAt: true, _count: { select: { items: true } } } }),
  ]);

  return (
    <div className="space-y-6">
      <SimpleList title={`Veilingen (${auctions.length})`} items={auctions.map((a) => ({ id: a.id, primary: a.title, secondary: `${a.status} · €${(a.currentBid ?? a.startingBid).toFixed(2)}`, when: a.createdAt }))} />
      <SimpleList title={`Listings (${listings.length})`} items={listings.map((l) => ({ id: l.id, primary: l.title, secondary: `${l.status} · €${(l.price ?? 0).toFixed(2)}`, when: l.createdAt }))} />
      <SimpleList title={`Claimsales (${claimsales.length})`} items={claimsales.map((c) => ({ id: c.id, primary: c.title, secondary: `${c.status} · ${c._count.items} items`, when: c.createdAt }))} />
    </div>
  );
}

async function PurchasesTab({ userId }: { userId: string }) {
  const bundles = await prisma.shippingBundle.findMany({
    where: { buyerId: userId, status: { not: "PENDING" } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, status: true, totalCost: true, totalItemCost: true, shippingCost: true, createdAt: true, seller: { select: { displayName: true } }, _count: { select: { items: true } } },
  });

  return (
    <SimpleList
      title={`Aankopen (${bundles.length})`}
      items={bundles.map((b) => ({
        id: b.id,
        primary: `Bundle van ${b.seller.displayName} (${b._count.items} items)`,
        secondary: `${b.status} · €${b.totalCost.toFixed(2)}`,
        when: b.createdAt,
      }))}
    />
  );
}

async function DisputesTab({ userId }: { userId: string }) {
  const disputes = await prisma.disputeV2.findMany({
    where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      buyer: { select: { displayName: true } },
      seller: { select: { displayName: true } },
      bundle: { select: { orderNumber: true, totalCost: true } },
    },
  });

  return (
    <SimpleList
      title={`Geschillen (${disputes.length})`}
      items={disputes.map((d) => ({
        id: d.id,
        primary: `${d.buyerId === userId ? "Als koper" : "Als verkoper"} · ${d.buyer.displayName} ↔ ${d.seller.displayName} · ${d.bundle.orderNumber}`,
        secondary: `${d.status} · ${d.reasonCategory} · €${d.bundle.totalCost.toFixed(2)}${d.finalRefund ? ` · terugbetaald €${d.finalRefund.toFixed(2)}` : ""} · /dashboard/geschillen/${d.id}`,
        when: d.createdAt,
      }))}
    />
  );
}

async function WithdrawalsTab({ userId }: { userId: string }) {
  const ws = await prisma.withdrawalRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return (
    <SimpleList
      title={`Withdrawals (${ws.length})`}
      items={ws.map((w) => ({
        id: w.id,
        primary: `€${w.amount.toFixed(2)} naar ${maskIban(decryptIban(w.iban) ?? "")}`,
        secondary: `${w.status}${w.rejectReason ? " · " + w.rejectReason : ""}`,
        when: w.createdAt,
      }))}
    />
  );
}

async function ReportsTab({ userId }: { userId: string }) {
  const [filed, received] = await Promise.all([
    prisma.userReport.findMany({ where: { reporterId: userId }, orderBy: { createdAt: "desc" }, take: 50, include: { reported: { select: { displayName: true } } } }),
    prisma.userReport.findMany({ where: { reportedId: userId }, orderBy: { createdAt: "desc" }, take: 50, include: { reporter: { select: { displayName: true } } } }),
  ]);
  return (
    <div className="space-y-6">
      <SimpleList title={`Ingediende rapporten (${filed.length})`} items={filed.map((r) => ({ id: r.id, primary: `Tegen ${r.reported.displayName}`, secondary: `${r.status} · ${r.reason}`, when: r.createdAt }))} />
      <SimpleList title={`Ontvangen rapporten (${received.length})`} items={received.map((r) => ({ id: r.id, primary: `Door ${r.reporter.displayName}`, secondary: `${r.status} · ${r.reason}`, when: r.createdAt }))} />
    </div>
  );
}

async function SuspensionsTab({ userId }: { userId: string }) {
  const events = await prisma.adminAuditLog.findMany({
    where: {
      targetId: userId,
      action: { in: ["SUSPEND_USER", "LIFT_SUSPENSION"] },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { admin: { select: { displayName: true } } },
  });
  return (
    <SimpleList
      title={`Suspensions historie (${events.length})`}
      items={events.map((e) => {
        let meta: { type?: string; reason?: string; days?: number } = {};
        try { meta = e.metadata ? JSON.parse(e.metadata) : {}; } catch { /* */ }
        return {
          id: e.id,
          primary: `${e.action} door ${e.admin?.displayName ?? "systeem"}`,
          secondary: e.action === "SUSPEND_USER" ? `${meta.type ?? ""}${meta.days ? ` · ${meta.days} dagen` : ""}${meta.reason ? ` · ${meta.reason}` : ""}` : "",
          when: e.createdAt,
        };
      })}
    />
  );
}

async function ReviewsTab({ userId }: { userId: string }) {
  const [given, received] = await Promise.all([
    prisma.review.findMany({ where: { reviewerId: userId }, orderBy: { createdAt: "desc" }, take: 50, include: { seller: { select: { displayName: true } } } }),
    prisma.review.findMany({ where: { sellerId: userId }, orderBy: { createdAt: "desc" }, take: 50, include: { reviewer: { select: { displayName: true } } } }),
  ]);
  return (
    <div className="space-y-6">
      <SimpleList title={`Gegeven (${given.length})`} items={given.map((r) => ({ id: r.id, primary: `Aan ${r.seller.displayName}: ${r.rating}★`, secondary: r.comment ?? "", when: r.createdAt }))} />
      <SimpleList title={`Ontvangen (${received.length})`} items={received.map((r) => ({ id: r.id, primary: `Van ${r.reviewer.displayName}: ${r.rating}★`, secondary: r.comment ?? "", when: r.createdAt }))} />
    </div>
  );
}

async function EmberTab({ userId, ember, bonusXP, loginStreak }: { userId: string; ember: number; bonusXP: number; loginStreak: number }) {
  const txs = await prisma.emberTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Ember balance" value={ember.toLocaleString("nl-NL")} />
        <StatCard label="Bonus XP" value={bonusXP.toLocaleString("nl-NL")} />
        <StatCard label="Login streak" value={`${loginStreak} dagen`} />
      </div>
      <SimpleList
        title={`Ember-transacties (${txs.length})`}
        items={txs.map((t) => ({
          id: t.id,
          primary: `${t.type} · ${t.amount > 0 ? "+" : ""}${t.amount}`,
          secondary: t.description ?? "",
          when: t.createdAt,
        }))}
      />
    </div>
  );
}

async function AuditTab({ userId }: { userId: string }) {
  const entries = await prisma.adminAuditLog.findMany({
    where: { targetId: userId, targetType: "USER" },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { admin: { select: { displayName: true } } },
  });
  return (
    <SimpleList
      title={`Admin-acties op deze user (${entries.length})`}
      items={entries.map((e) => ({
        id: e.id,
        primary: `${e.action} door ${e.admin?.displayName ?? "systeem"}`,
        secondary: e.metadata ?? "",
        when: e.createdAt,
      }))}
    />
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function SimpleList({ title, items }: { title: string; items: { id: string; primary: string; secondary?: string; when: Date }[] }) {
  return (
    <DashboardSection variant="plain" title={title}>
      {items.length === 0 ? (
        <EmptyState icon={Inbox} title="Geen entries." compact />
      ) : (
        <ul className="divide-y divide-border dash-card">
          {items.map((it) => (
            <li key={it.id} className="flex flex-col gap-1 px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="font-medium">{it.primary}</p>
                {it.secondary && <p className="text-xs text-muted-foreground truncate">{it.secondary}</p>}
              </div>
              <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                {it.when.toLocaleString("nl-NL")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}
