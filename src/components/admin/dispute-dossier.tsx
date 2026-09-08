/* eslint-disable @next/next/no-img-element */
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { StatusBadge, type StatusTone } from "@/components/dashboard/ui/status-badge";
import { getOpenPendingFeesTotal } from "@/lib/pending-fees";
import { isUserSuspended } from "@/lib/suspension";
import {
  Package,
  Users,
  MessageSquare,
  Link2,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

// Admin-dossier bij een geschil: ALLES wat de beheerder nodig heeft om te
// beoordelen of een geschil terecht is — zonder door vijf schermen te klikken.
//   1. Bestelling & levering (bron, bedragen, verzendmethode, adres, data)
//   2. Items + de oorspronkelijke advertentie-tekst en -foto's (wat is beloofd?)
//   3. Beide partijen: account-leeftijd, verificaties, historie, eerdere
//      geschillen, meldingen, schorsingen, saldo's (verkoper)
//   4. Chat tussen koper en verkoper
//   5. Gerelateerd: trackingtickets, annuleringsverzoeken, geldstromen op
//      deze bestelling, reviews
// Server component; alleen gerenderd voor role === "admin".

function parseUrls(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// Buiten de component (purity-lint): server component, rendert per request.
const nowMs = () => Date.now();

const fmt = (d: Date | null | undefined, time = false) =>
  d
    ? d.toLocaleString("nl-NL", { day: "numeric", month: "short", year: "numeric", ...(time ? { hour: "2-digit", minute: "2-digit" } : {}) })
    : "—";
const eur = (n: number) => `€${n.toFixed(2)}`;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium text-foreground">{children}</span>
    </div>
  );
}

function Thumbs({ urls, size = 56 }: { urls: string[]; size?: number }) {
  if (urls.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {urls.map((u, i) => (
        <a key={`${u}-${i}`} href={u} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-md border border-border hover:opacity-80" style={{ width: size, height: size }}>
          <img src={u} alt="" className="h-full w-full object-cover" loading="lazy" />
        </a>
      ))}
    </div>
  );
}

async function partyProfile(userId: string, role: "buyer" | "seller") {
  const [user, completedSales, completedPurchases, disputesAsBuyer, disputesAsBuyerWon, disputesAsSeller, disputesAsSellerLost, reportsOpen, reportsTotal, autoExpired, reviewAgg, openFees] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          displayName: true,
          firstName: true,
          lastName: true,
          createdAt: true,
          country: true,
          city: true,
          accountType: true,
          isVerified: true,
          isIbanVerified: true,
          isAddressVerified: true,
          emailVerifiedAt: true,
          suspendedUntil: true,
          suspensionType: true,
          suspensionReason: true,
          paymentFailureCount: true,
          balance: true,
          heldBalance: true,
          reservedBalance: true,
          lastLoginIpAt: true,
        },
      }),
      prisma.shippingBundle.count({ where: { sellerId: userId, status: "COMPLETED" } }),
      prisma.shippingBundle.count({ where: { buyerId: userId, status: "COMPLETED" } }),
      prisma.disputeV2.count({ where: { buyerId: userId } }),
      prisma.disputeV2.count({ where: { buyerId: userId, finalRefund: { gt: 0 } } }),
      prisma.disputeV2.count({ where: { sellerId: userId } }),
      prisma.disputeV2.count({ where: { sellerId: userId, finalRefund: { gt: 0 } } }),
      prisma.userReport.count({ where: { reportedId: userId, status: { in: ["OPEN", "REVIEWING"] } } }),
      prisma.userReport.count({ where: { reportedId: userId } }),
      prisma.shippingBundle.count({ where: { sellerId: userId, autoExpiredAt: { not: null } } }),
      prisma.review.aggregate({ where: { sellerId: userId }, _avg: { rating: true }, _count: { _all: true } }),
      getOpenPendingFeesTotal(userId),
    ]);
  return { role, user, completedSales, completedPurchases, disputesAsBuyer, disputesAsBuyerWon, disputesAsSeller, disputesAsSellerLost, reportsOpen, reportsTotal, autoExpired, reviewAgg, openFees };
}

export async function AdminDisputeDossier({ disputeId }: { disputeId: string }) {
  const dispute = await prisma.disputeV2.findUnique({
    where: { id: disputeId },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      fundingSource: true,
      escalatedFromShippingIssueId: true,
      bundle: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentMode: true,
          deliveryMethod: true,
          createdAt: true,
          shippedAt: true,
          deliveredAt: true,
          trackingUrl: true,
          lockedForPackingAt: true,
          autoExpiredAt: true,
          totalCost: true,
          totalItemCost: true,
          shippingCost: true,
          refundedAmount: true,
          buyerStreet: true,
          buyerHouseNumber: true,
          buyerPostalCode: true,
          buyerCity: true,
          buyerCountry: true,
          shippingMethod: { select: { carrier: true, service: true, serviceName: true } },
          auction: { select: { id: true, title: true, description: true, imageUrls: true, condition: true, finalPrice: true, auctionType: true, cardName: true } },
          listing: { select: { id: true, title: true, description: true, imageUrls: true, condition: true, price: true, listingType: true, cardName: true } },
          bundleListings: { select: { priceSnapshot: true, listing: { select: { id: true, title: true, description: true, imageUrls: true, condition: true } } } },
          items: { select: { id: true, cardName: true, condition: true, price: true, reference: true, sellerNote: true, itemDescription: true, imageUrls: true, claimsaleId: true } },
          cardItems: { select: { id: true, cardName: true, condition: true, quantity: true, listingId: true } },
          cancellationRequests: { select: { id: true, reason: true, status: true, createdAt: true, proposedById: true }, orderBy: { createdAt: "asc" } },
          shippingIssues: { select: { id: true, type: true, status: true, description: true, resolution: true, createdAt: true, reporterId: true }, orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (!dispute) return null;
  const b = dispute.bundle;

  const [buyer, seller, transactions, reviews, conversations] = await Promise.all([
    partyProfile(dispute.buyerId, "buyer"),
    partyProfile(dispute.sellerId, "seller"),
    prisma.transaction.findMany({
      where: { relatedShippingBundleId: b.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, userId: true, type: true, amount: true, description: true, createdAt: true },
    }),
    prisma.review.findMany({
      where: { shippingBundleId: b.id },
      select: { id: true, rating: true, comment: true, createdAt: true, reviewerId: true },
    }),
    prisma.conversation.findMany({
      where: {
        AND: [
          { participants: { some: { userId: dispute.buyerId } } },
          { participants: { some: { userId: dispute.sellerId } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: {
        id: true,
        listingId: true,
        auctionId: true,
        claimsaleId: true,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 40,
          select: { id: true, body: true, imageUrl: true, senderId: true, createdAt: true, sender: { select: { displayName: true } } },
        },
      },
    }),
  ]);

  const sourceLabel = b.auction ? "Veiling" : b.listing ? "Marktplaats" : b.bundleListings.length > 0 ? "Bundel (marktplaats)" : b.items.length > 0 ? "Claimsale" : "Onbekend";
  const sourceHref = b.auction ? `/veilingen/${b.auction.id}` : b.listing ? `/marktplaats/${b.listing.id}` : b.items[0]?.claimsaleId ? `/claimsales/${b.items[0].claimsaleId}` : null;
  const claimsaleIds = [...new Set(b.items.map((i) => i.claimsaleId))];

  const names: Record<string, string> = {
    [dispute.buyerId]: buyer.user?.displayName ?? "koper",
    [dispute.sellerId]: seller.user?.displayName ?? "verkoper",
  };

  const flagsFor = (p: Awaited<ReturnType<typeof partyProfile>>) => {
    const u = p.user;
    if (!u) return [] as { label: string; tone: StatusTone }[];
    const flags: { label: string; tone: StatusTone }[] = [];
    if (isUserSuspended(u)) flags.push({ label: u.suspensionType === "PERMANENT" ? "permanent geschorst" : `geschorst tot ${fmt(u.suspendedUntil)}`, tone: "danger" });
    if (u.paymentFailureCount > 0) flags.push({ label: `${u.paymentFailureCount}× wanbetaling`, tone: "danger" });
    if (p.reportsOpen > 0) flags.push({ label: `${p.reportsOpen} open melding(en)`, tone: "warning" });
    if (p.role === "seller" && p.autoExpired > 0) flags.push({ label: `${p.autoExpired}× niet verzonden (auto-cancel)`, tone: "warning" });
    if (p.role === "seller" && p.disputesAsSellerLost > 0) flags.push({ label: `${p.disputesAsSellerLost}× geschil verloren`, tone: "warning" });
    if (p.role === "buyer" && p.disputesAsBuyer >= 3) flags.push({ label: `${p.disputesAsBuyer} geschillen geopend`, tone: "warning" });
    if (p.openFees > 0) flags.push({ label: `openstaande kosten ${eur(p.openFees)}`, tone: "warning" });
    const ageDays = Math.floor((nowMs() - u.createdAt.getTime()) / 86_400_000);
    if (ageDays < 30) flags.push({ label: `nieuw account (${ageDays}d)`, tone: "info" });
    if (!u.emailVerifiedAt) flags.push({ label: "e-mail niet geverifieerd", tone: "warning" });
    return flags;
  };

  const partyCard = (p: Awaited<ReturnType<typeof partyProfile>>) => {
    const u = p.user;
    if (!u) return null;
    const flags = flagsFor(p);
    return (
      <div className="rounded-md border border-border p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{p.role === "buyer" ? "Koper" : "Verkoper"}</p>
            <Link href={`/dashboard/admin/users/${u.id}`} className="text-sm font-semibold text-primary hover:underline">
              {u.displayName}
            </Link>
            {(u.firstName || u.lastName) && <p className="text-xs text-muted-foreground">{[u.firstName, u.lastName].filter(Boolean).join(" ")}</p>}
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            {u.isVerified && <StatusBadge tone="info" icon={ShieldCheck}>ID</StatusBadge>}
            {u.isIbanVerified && <StatusBadge tone="success">IBAN</StatusBadge>}
            {u.isAddressVerified && <StatusBadge tone="primary">Adres</StatusBadge>}
          </div>
        </div>
        {flags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {flags.map((f) => (
              <StatusBadge key={f.label} tone={f.tone} icon={f.tone === "danger" ? AlertTriangle : undefined}>{f.label}</StatusBadge>
            ))}
          </div>
        )}
        <div className="mt-2 divide-y divide-border/60">
          <Row label="Lid sinds">{fmt(u.createdAt)} · {u.accountType}</Row>
          <Row label="Locatie">{[u.city, u.country].filter(Boolean).join(", ") || "—"}</Row>
          <Row label="Laatste login">{fmt(u.lastLoginIpAt, true)}</Row>
          <Row label="Afgeronde verkopen / aankopen">{p.completedSales} / {p.completedPurchases}</Row>
          <Row label="Geschillen als koper">{p.disputesAsBuyer} ({p.disputesAsBuyerWon}× terugbetaling)</Row>
          <Row label="Geschillen als verkoper">{p.disputesAsSeller} ({p.disputesAsSellerLost}× terugbetaling)</Row>
          <Row label="Meldingen tegen">{p.reportsTotal} ({p.reportsOpen} open)</Row>
          {p.role === "seller" && (
            <>
              <Row label="Reviews als verkoper">{p.reviewAgg._count._all > 0 ? `${(p.reviewAgg._avg.rating ?? 0).toFixed(1)} ★ (${p.reviewAgg._count._all})` : "—"}</Row>
              <Row label="Saldo / in bewaring / gereserveerd">{eur(u.balance)} / {eur(u.heldBalance)} / {eur(u.reservedBalance)}</Row>
            </>
          )}
        </div>
      </div>
    );
  };

  const shipService = b.shippingMethod ? [b.shippingMethod.carrier, b.shippingMethod.service ?? b.shippingMethod.serviceName].filter(Boolean).join(" · ") : "—";

  return (
    <div className="space-y-4">
      {/* 1. Bestelling & levering */}
      <DashboardSection title="Dossier — bestelling" icon={<Package className="size-4" />}>
        <div className="divide-y divide-border/60">
          <Row label="Bron">
            {sourceHref ? (
              <Link href={sourceHref} className="inline-flex items-center gap-1 text-primary hover:underline">
                {sourceLabel} <ExternalLink className="h-3 w-3" />
              </Link>
            ) : (
              sourceLabel
            )}
          </Row>
          <Row label="Betaling / levering">{b.paymentMode} · {b.deliveryMethod}</Row>
          <Row label="Terugbetaling uit">{dispute.fundingSource === "ESCROW" ? "bewaring (escrow)" : "verkoperssaldo (escrow al vrijgegeven)"}</Row>
          <Row label="Besteld">{fmt(b.createdAt, true)}</Row>
          <Row label="Verzonden">{fmt(b.shippedAt, true)}</Row>
          <Row label="Geleverd / bevestigd">{fmt(b.deliveredAt, true)}</Row>
          <Row label="Verzendmethode">{shipService}</Row>
          <Row label="Tracking">
            {b.trackingUrl ? (
              <a href={b.trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                openen <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              "geen"
            )}
          </Row>
          <Row label="Verzendadres (snapshot)">
            {b.buyerStreet ? `${b.buyerStreet} ${b.buyerHouseNumber ?? ""}, ${b.buyerPostalCode ?? ""} ${b.buyerCity ?? ""} ${b.buyerCountry ?? ""}` : "—"}
          </Row>
          <Row label="Items / verzending / totaal">{eur(b.totalItemCost)} / {eur(b.shippingCost)} / {eur(b.totalCost)}</Row>
          <Row label="Al terugbetaald">{eur(b.refundedAmount ?? 0)}</Row>
          <Row label="Bundle-status">{b.status}{b.autoExpiredAt ? " · auto-geannuleerd" : ""}</Row>
        </div>
      </DashboardSection>

      {/* 2. Items + oorspronkelijke advertentie */}
      <DashboardSection title="Wat is er verkocht (en beloofd)?" icon={<Package className="size-4" />}>
        <div className="space-y-3">
          {b.auction && (
            <div>
              <p className="text-sm font-semibold text-foreground">{b.auction.title}</p>
              <p className="text-xs text-muted-foreground">
                {b.auction.auctionType}{b.auction.cardName ? ` · ${b.auction.cardName}` : ""}{b.auction.condition ? ` · ${b.auction.condition}` : ""}{b.auction.finalPrice ? ` · winnend bod ${eur(b.auction.finalPrice)}` : ""}
              </p>
              {b.auction.description && <p className="mt-1 whitespace-pre-wrap text-xs text-foreground/90">{b.auction.description}</p>}
              <Thumbs urls={parseUrls(b.auction.imageUrls)} />
            </div>
          )}
          {b.listing && (
            <div>
              <p className="text-sm font-semibold text-foreground">{b.listing.title}</p>
              <p className="text-xs text-muted-foreground">
                {b.listing.listingType}{b.listing.cardName ? ` · ${b.listing.cardName}` : ""}{b.listing.condition ? ` · ${b.listing.condition}` : ""}{b.listing.price ? ` · ${eur(b.listing.price)}` : ""}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-foreground/90">{b.listing.description}</p>
              <Thumbs urls={parseUrls(b.listing.imageUrls)} />
            </div>
          )}
          {b.bundleListings.map((bl) => (
            <div key={bl.listing.id} className="border-t border-border/60 pt-2 first:border-t-0 first:pt-0">
              <Link href={`/marktplaats/${bl.listing.id}`} className="text-sm font-semibold text-primary hover:underline">{bl.listing.title}</Link>
              <p className="text-xs text-muted-foreground">{bl.listing.condition ?? ""} · {eur(bl.priceSnapshot)}</p>
              <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-xs text-foreground/90">{bl.listing.description}</p>
              <Thumbs urls={parseUrls(bl.listing.imageUrls)} size={48} />
            </div>
          ))}
          {b.items.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Claimsale-items ({b.items.length}){claimsaleIds.length > 0 && (
                  <>
                    {" · "}
                    {claimsaleIds.map((id) => (
                      <Link key={id} href={`/claimsales/${id}`} className="text-primary hover:underline">claimsale {id.slice(0, 6)}</Link>
                    ))}
                  </>
                )}
              </p>
              <ul className="mt-1 divide-y divide-border/60">
                {b.items.map((it) => (
                  <li key={it.id} className="py-2">
                    <div className="flex items-start justify-between gap-2 text-sm">
                      <span className="font-medium text-foreground">{it.cardName}{it.reference ? ` (${it.reference})` : ""}</span>
                      <span className="shrink-0 tabular-nums text-foreground">{eur(it.price)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{it.condition}{it.sellerNote ? ` · ${it.sellerNote}` : ""}</p>
                    {it.itemDescription && <p className="mt-1 whitespace-pre-wrap text-xs text-foreground/90">{it.itemDescription}</p>}
                    <Thumbs urls={parseUrls(it.imageUrls)} size={48} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {b.cardItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kaarten uit advertentie ({b.cardItems.length})</p>
              <ul className="mt-1 divide-y divide-border/60 text-sm">
                {b.cardItems.map((ci) => (
                  <li key={ci.id} className="flex items-center justify-between py-1.5">
                    <span className="text-foreground">{ci.quantity > 1 ? `${ci.quantity}× ` : ""}{ci.cardName}</span>
                    <span className="text-xs text-muted-foreground">{ci.condition ?? ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!b.auction && !b.listing && b.bundleListings.length === 0 && b.items.length === 0 && b.cardItems.length === 0 && (
            <p className="text-sm text-muted-foreground">Geen item-details gevonden op deze bestelling.</p>
          )}
        </div>
      </DashboardSection>

      {/* 3. Partijen */}
      <DashboardSection title="Partijen" icon={<Users className="size-4" />}>
        <div className="space-y-3">
          {partyCard(buyer)}
          {partyCard(seller)}
        </div>
      </DashboardSection>

      {/* 4. Chat */}
      <DashboardSection title="Chat tussen koper en verkoper" icon={<MessageSquare className="size-4" />} contentClassName="p-0">
        {conversations.length === 0 || conversations.every((c) => c.messages.length === 0) ? (
          <p className="p-4 text-sm text-muted-foreground">Geen berichten tussen deze twee gebruikers.</p>
        ) : (
          <div className="max-h-[32rem] overflow-y-auto">
            {conversations.map((c) => (
              <div key={c.id} className="border-b border-border/60 last:border-b-0">
                <p className="bg-muted/60 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Gesprek {c.id.slice(0, 6)}{c.listingId ? " · advertentie" : c.auctionId ? " · veiling" : c.claimsaleId ? " · claimsale" : ""} · laatste {c.messages.length} berichten
                </p>
                <ul className="space-y-2 px-4 py-3">
                  {[...c.messages].reverse().map((m) => {
                    const mine = m.senderId === dispute.buyerId;
                    return (
                      <li key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                        <div className={`max-w-[85%] rounded-md px-3 py-2 text-sm ${mine ? "bg-amber-500/10 text-foreground" : "bg-sky-500/10 text-foreground"}`}>
                          <p className="text-[11px] font-semibold text-muted-foreground">
                            {m.sender.displayName} · {fmt(m.createdAt, true)}
                          </p>
                          {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                          {m.imageUrl && (
                            <a href={m.imageUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block w-24 overflow-hidden rounded border border-border">
                              <img src={m.imageUrl} alt="" className="h-24 w-24 object-cover" loading="lazy" />
                            </a>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </DashboardSection>

      {/* 5. Gerelateerd */}
      <DashboardSection title="Gerelateerd op deze bestelling" icon={<Link2 className="size-4" />}>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trackingtickets ({b.shippingIssues.length})</p>
            {b.shippingIssues.length === 0 ? (
              <p className="text-xs text-muted-foreground">Geen.</p>
            ) : (
              <ul className="mt-1 space-y-1.5">
                {b.shippingIssues.map((s) => (
                  <li key={s.id} className="rounded-md border border-border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">{s.type}</span>
                      <StatusBadge tone={s.status.startsWith("RESOLVED") ? "neutral" : s.status === "ESCALATED_TO_DISPUTE" ? "danger" : "warning"}>{s.status}</StatusBadge>
                    </div>
                    <p className="text-xs text-muted-foreground">{fmt(s.createdAt)} · door {names[s.reporterId] ?? "systeem"}</p>
                    <p className="mt-1 text-xs text-foreground/90">{s.description}</p>
                    {s.resolution && <p className="mt-1 text-xs text-muted-foreground">Admin: {s.resolution}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Annuleringsverzoeken ({b.cancellationRequests.length})</p>
            {b.cancellationRequests.length === 0 ? (
              <p className="text-xs text-muted-foreground">Geen.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {b.cancellationRequests.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-foreground">{fmt(c.createdAt)} · {names[c.proposedById] ?? "?"} · {c.reason}</span>
                    <StatusBadge tone={c.status === "ACCEPTED" ? "success" : c.status === "PENDING" ? "warning" : "neutral"}>{c.status}</StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Geldstromen op deze bestelling ({transactions.length})</p>
            {transactions.length === 0 ? (
              <p className="text-xs text-muted-foreground">Geen transacties gevonden.</p>
            ) : (
              <ul className="mt-1 divide-y divide-border/60">
                {transactions.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-2 py-1.5 text-xs">
                    <div className="min-w-0">
                      <p className="text-foreground">{names[t.userId] ?? t.userId.slice(0, 6)} · <span className="font-mono">{t.type}</span></p>
                      <p className="truncate text-muted-foreground">{t.description}</p>
                      <p className="text-muted-foreground">{fmt(t.createdAt, true)}</p>
                    </div>
                    <span className={`shrink-0 tabular-nums font-medium ${t.amount < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                      {t.amount < 0 ? "−" : "+"}{eur(Math.abs(t.amount))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reviews op deze bestelling ({reviews.length})</p>
            {reviews.length === 0 ? (
              <p className="text-xs text-muted-foreground">Geen.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {reviews.map((r) => (
                  <li key={r.id} className="text-xs text-foreground">
                    {r.rating} ★ door {names[r.reviewerId] ?? "?"} · {fmt(r.createdAt)}{r.comment ? ` — “${r.comment}”` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {dispute.escalatedFromShippingIssueId && (
            <p className="text-xs text-muted-foreground">Dit geschil is door een beheerder aangemaakt vanuit trackingticket {dispute.escalatedFromShippingIssueId.slice(0, 8)}.</p>
          )}
        </div>
      </DashboardSection>
    </div>
  );
}
