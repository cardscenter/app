"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import {
  Upload,
  X,
  ShieldCheck,
  Scale,
  ExternalLink,
  Clock,
  Undo2,
  MessageSquareText,
  Lock,
  Gavel,
} from "lucide-react";
import {
  respondToDisputeV2,
  proposeRefundV2,
  acceptProposalV2,
  rejectProposalV2,
  requestEscalationV2,
  addEvidenceV2,
  adminResolveDisputeV2,
  adminTakeOverDisputeV2,
  adminAddDisputeNoteV2,
  withdrawDisputeV2,
} from "@/actions/dispute-v2";
import {
  DISPUTE_V2_RESOLUTIONS,
  DISPUTE_V2_RESOLUTION_LABELS,
  DISPUTE_V2_STATUS_LABELS,
  DISPUTE_V2_REASON_LABELS,
  DISPUTE_V2_OPEN_STATUSES,
  DISPUTE_V2_ADMIN_SLA_DAYS,
  DISPUTE_V2_BUYER_REVIEW_DAYS,
  DISPUTE_V2_RESPONSE_DAYS,
  DISPUTE_V2_MAX_EVIDENCE_PER_PARTY,
  type DisputeV2Resolution,
  type DisputeV2Status,
  type DisputeV2ReasonCategory,
  type DisputeV2NoteVisibility,
} from "@/lib/dispute-v2/config";
import { StatusBadge, type StatusTone } from "@/components/dashboard/ui/status-badge";

type DisputeEvent = {
  id: string;
  type: string;
  actorType: string;
  actorId: string | null;
  actorName: string | null;
  message: string | null;
  createdAt: string;
  visibility: "INTERNAL" | "PARTIES" | null;
};

export type DisputeV2DetailData = {
  id: string;
  status: string;
  reasonCategory: string;
  reasonSubCategory: string | null;
  buyerStatement: string;
  sellerStatement: string | null;
  evidenceBuyer: string[];
  evidenceSeller: string[];
  proposedRefund: number | null;
  proposedById: string | null;
  finalRefund: number | null;
  resolution: string | null;
  adminNotes: string | null;
  fundingSource: string;
  responseDeadline: string;
  buyerReviewDeadline: string | null;
  adminSLADeadline: string | null;
  createdAt: string;
  resolvedAt: string | null;
  buyer: { id: string; displayName: string };
  seller: { id: string; displayName: string };
  bundle: {
    id: string;
    orderNumber: string;
    totalCost: number;
    totalItemCost: number;
    shippingCost: number;
    refundedAmount: number;
    status: string;
    shippedAt: string | null;
    deliveredAt: string | null;
    trackingUrl: string | null;
    shippingProofUrls: string[];
    paymentMode: string;
    deliveryMethod: string;
  };
  events: DisputeEvent[];
};

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

function fmtDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

/**
 * Eén blok bovenaan dat per rol vertelt waar het geschil staat, wat de
 * volgende stap is en tot wanneer — zodat niemand hoeft te raden.
 */
function phaseInfo(role: "buyer" | "seller" | "admin", d: DisputeV2DetailData): { title: string; body: string; tone: StatusTone } {
  const iAmProposer = d.proposedById === (role === "buyer" ? d.buyer.id : d.seller.id);
  switch (d.status) {
    case "OPEN":
      if (role === "seller")
        return {
          tone: "warning",
          title: `Jouw reactie is nodig — uiterlijk ${fmtDate(d.responseDeadline)}`,
          body: `Leg uit wat er volgens jou gebeurd is en voeg foto's toe. Je kunt meteen een terugbetaling voorstellen. Reageer je niet binnen ${DISPUTE_V2_RESPONSE_DAYS} dagen, dan krijgt de koper automatisch het volledige bedrag terug.`,
        };
      return {
        tone: "info",
        title: `Wachten op de verkoper — tot ${fmtDate(d.responseDeadline)}`,
        body: role === "buyer"
          ? "De verkoper kan reageren, bewijs toevoegen of een terugbetaling voorstellen. Reageert de verkoper niet op tijd, dan wordt het geschil automatisch in jouw voordeel afgerond. Je kunt intussen extra foto's toevoegen of het geschil intrekken."
          : "De verkoper heeft nog niet gereageerd. Je kunt het geschil nu al overnemen of een vraag stellen aan een van de partijen.",
      };
    case "SELLER_RESPONDED":
      if (role === "buyer")
        return {
          tone: "warning",
          title: `Jouw beurt — uiterlijk ${fmtDate(d.buyerReviewDeadline)}`,
          body: "Lees de reactie van de verkoper. Je kunt het geschil intrekken (alles is opgelost), een terugbetaling voorstellen of de beheerder inschakelen. Doe je niets binnen de termijn, dan wordt het geschil gesloten zonder terugbetaling.",
        };
      return {
        tone: "info",
        title: `Wachten op de koper — tot ${fmtDate(d.buyerReviewDeadline)}`,
        body: role === "seller"
          ? "De koper kan het geschil intrekken, een voorstel doen of de beheerder inschakelen. Je kunt zelf ook een voorstel doen of de beheerder inschakelen."
          : "Beide partijen hebben hun kant toegelicht. Je kunt overnemen, een vraag stellen of direct beslissen.",
      };
    case "MEDIATION":
      if (role === "admin")
        return { tone: "primary", title: `Voorstel van €${(d.proposedRefund ?? 0).toFixed(2)} staat uit`, body: `Reactietermijn tot ${fmtDate(d.buyerReviewDeadline)}. Blijft een reactie uit, dan komt het geschil automatisch bij jou.` };
      if (iAmProposer)
        return {
          tone: "info",
          title: `Je voorstel van €${(d.proposedRefund ?? 0).toFixed(2)} wacht op antwoord — tot ${fmtDate(d.buyerReviewDeadline)}`,
          body: "De andere partij kan accepteren, afwijzen of een tegenvoorstel doen. Zonder reactie gaat het geschil automatisch naar de beheerder. Je kunt je voorstel aanpassen door een nieuw bedrag voor te stellen.",
        };
      return {
        tone: "warning",
        title: `Reageer op het voorstel van €${(d.proposedRefund ?? 0).toFixed(2)} — uiterlijk ${fmtDate(d.buyerReviewDeadline)}`,
        body: "Accepteer (het geschil is dan direct afgerond), wijs af of doe een tegenvoorstel. Zonder reactie gaat het geschil automatisch naar de beheerder.",
      };
    case "ESCALATED":
      return {
        tone: "danger",
        title: role === "admin" ? `Wacht op jouw beslissing${d.adminSLADeadline ? ` — streefdatum ${fmtDate(d.adminSLADeadline)}` : ""}` : `Bij de beheerder — beslissing binnen ongeveer ${DISPUTE_V2_ADMIN_SLA_DAYS} dagen`,
        body: role === "admin"
          ? "Bekijk het dossier hiernaast (bestelling, items, bewijs, chat, geschiedenis van beide partijen). Stel zo nodig eerst een vraag aan een partij; beslis daarna met een onderbouwing die beide partijen te zien krijgen."
          : "De beheerder beoordeelt alle informatie: de bestelling, beide verklaringen, foto's en de chat. Je kunt nog bewijs toevoegen. De beslissing is bindend.",
      };
    case "CANCELLED":
      return { tone: "neutral", title: "Ingetrokken door de koper", body: "Het geschil is gesloten zonder terugbetaling." };
    default: {
      const label = DISPUTE_V2_RESOLUTION_LABELS[d.resolution as DisputeV2Resolution] ?? d.resolution ?? "";
      return {
        tone: d.finalRefund && d.finalRefund > 0 ? "success" : "neutral",
        title: `Afgerond op ${fmtDate(d.resolvedAt)} — ${label.toLowerCase()}`,
        body: d.finalRefund && d.finalRefund > 0
          ? `€${d.finalRefund.toFixed(2)} is teruggestort naar de koper.${d.status === "RESOLVED_ADMIN" ? " De onderbouwing van de beheerder staat hieronder." : ""}`
          : "Er is niets terugbetaald; het bedrag is aan de verkoper uitgekeerd.",
      };
    }
  }
}

const TONE_BOX: Record<StatusTone, string> = {
  warning: "border-amber-300/60 bg-amber-50/60 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100",
  info: "border-sky-300/60 bg-sky-50/60 text-sky-900 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-100",
  primary: "border-violet-300/60 bg-violet-50/60 text-violet-900 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-100",
  danger: "border-rose-300/60 bg-rose-50/60 text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100",
  success: "border-emerald-300/60 bg-emerald-50/60 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100",
  neutral: "border-border bg-muted/40 text-foreground",
};

export function DisputeV2Detail({
  role,
  currentUserId,
  dispute,
}: {
  role: "buyer" | "seller" | "admin";
  currentUserId: string;
  dispute: DisputeV2DetailData;
}) {
  const router = useRouter();
  const remainingRefundable = Math.max(0, dispute.bundle.totalCost - dispute.bundle.refundedAmount);
  const isOpen = DISPUTE_V2_OPEN_STATUSES.has(dispute.status as DisputeV2Status);
  const isParty = role === "buyer" || role === "seller";
  const phase = phaseInfo(role, dispute);
  const canPropose = isParty && (dispute.status === "SELLER_RESPONDED" || dispute.status === "MEDIATION");
  const canEscalate = isParty && (dispute.status === "SELLER_RESPONDED" || dispute.status === "MEDIATION");
  const canWithdraw = role === "buyer" && ["OPEN", "SELLER_RESPONDED", "MEDIATION"].includes(dispute.status);
  const sellerMustRespond = role === "seller" && (dispute.status === "OPEN" || (dispute.status === "ESCALATED" && !dispute.sellerStatement));

  return (
    <div className="space-y-5">
      <header>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Geschil</span>
          <span className="font-mono">{dispute.id.slice(0, 8)}</span>
          <span>·</span>
          <span>Bestelling {dispute.bundle.orderNumber}</span>
          <span>·</span>
          <span>{fmtDate(dispute.createdAt)}</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold text-foreground">
          {DISPUTE_V2_REASON_LABELS[dispute.reasonCategory as DisputeV2ReasonCategory] ?? dispute.reasonCategory}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge tone={STATUS_TONE[dispute.status] ?? "neutral"}>
            {DISPUTE_V2_STATUS_LABELS[dispute.status as DisputeV2Status] ?? dispute.status}
          </StatusBadge>
          {dispute.fundingSource === "SELLER_BALANCE" && (
            <StatusBadge tone="neutral" icon={Clock}>na ontvangst · terugbetaling uit verkoperssaldo</StatusBadge>
          )}
          {dispute.reasonSubCategory && (
            <span className="text-xs text-muted-foreground">{dispute.reasonSubCategory.replace(/_/g, " ")}</span>
          )}
        </div>
      </header>

      {/* Fase-uitleg: waar staan we, wat is de volgende stap, tot wanneer */}
      <section className={`rounded-dash border p-4 ${TONE_BOX[phase.tone]}`}>
        <p className="text-sm font-semibold">{phase.title}</p>
        <p className="mt-1 text-sm opacity-90">{phase.body}</p>
      </section>

      {/* Bundle context */}
      <section className="dash-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bestelling</p>
        <div className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">Koper</p>
            <p className="font-medium text-foreground">{dispute.buyer.displayName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Verkoper</p>
            <p className="font-medium text-foreground">{dispute.seller.displayName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Totaal</p>
            <p className="font-medium text-foreground tabular-nums">
              &euro;{dispute.bundle.totalCost.toFixed(2)}
              <span className="ml-1 text-xs text-muted-foreground">(items €{dispute.bundle.totalItemCost.toFixed(2)} + verzending €{dispute.bundle.shippingCost.toFixed(2)})</span>
            </p>
            {dispute.bundle.refundedAmount > 0 && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">€{dispute.bundle.refundedAmount.toFixed(2)} al terugbetaald · nog €{remainingRefundable.toFixed(2)} in het geding</p>
            )}
          </div>
          <div>
            <p className="text-muted-foreground">Verzonden</p>
            <p className="font-medium text-foreground">{fmtDate(dispute.bundle.shippedAt)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{dispute.bundle.deliveryMethod === "PICKUP" ? "Opgehaald" : "Ontvangst bevestigd"}</p>
            <p className="font-medium text-foreground">{fmtDate(dispute.bundle.deliveredAt)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Tracking</p>
            {dispute.bundle.trackingUrl ? (
              <a href={dispute.bundle.trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                <ExternalLink className="h-3 w-3" /> Volg pakket
              </a>
            ) : (
              <p className="font-medium text-foreground">—</p>
            )}
          </div>
        </div>

        {dispute.bundle.shippingProofUrls.length > 0 && (
          <div className="mt-3 rounded-md border border-sky-200/60 bg-sky-50/40 p-3 dark:border-sky-900/40 dark:bg-sky-950/20">
            <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">Verzendbewijs van de verkoper ({dispute.bundle.shippingProofUrls.length})</p>
            <PhotoStrip urls={dispute.bundle.shippingProofUrls} altPrefix="Verzendbewijs" />
          </div>
        )}
      </section>

      {/* Buyer's statement */}
      <section className="rounded-dash border border-amber-200/60 bg-amber-50/40 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          Koper — {dispute.buyer.displayName}
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{dispute.buyerStatement}</p>
        {dispute.evidenceBuyer.length > 0 ? (
          <PhotoStrip urls={dispute.evidenceBuyer} altPrefix="Koper-bewijs" />
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Geen foto&apos;s toegevoegd.</p>
        )}
      </section>

      {/* Seller's response */}
      {dispute.sellerStatement ? (
        <section className="rounded-dash border border-blue-200/60 bg-blue-50/40 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
            Verkoper — {dispute.seller.displayName}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{dispute.sellerStatement}</p>
          {dispute.evidenceSeller.length > 0 ? (
            <PhotoStrip urls={dispute.evidenceSeller} altPrefix="Verkoper-bewijs" />
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Geen foto&apos;s toegevoegd.</p>
          )}
        </section>
      ) : (
        !sellerMustRespond && (
          <section className="rounded-dash border border-dashed border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Verkoper — {dispute.seller.displayName}</p>
            <p className="mt-1 text-sm text-muted-foreground">Nog geen reactie van de verkoper.</p>
          </section>
        )
      )}

      {/* Admin decision (visible to all when resolved) */}
      {dispute.adminNotes && (
        <section className="rounded-dash border border-violet-200/60 bg-violet-50/40 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
          <div className="flex items-center gap-2">
            <Gavel className="h-4 w-4 text-violet-700 dark:text-violet-300" />
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              Beslissing beheerder — {DISPUTE_V2_RESOLUTION_LABELS[dispute.resolution as DisputeV2Resolution] ?? dispute.resolution}
              {dispute.finalRefund !== null && dispute.finalRefund > 0 && <> · €{dispute.finalRefund.toFixed(2)} terugbetaald</>}
            </p>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{dispute.adminNotes}</p>
        </section>
      )}

      {/* Active proposal */}
      {dispute.status === "MEDIATION" && dispute.proposedRefund !== null && (
        <section className="rounded-dash border border-violet-300/60 bg-violet-50/50 p-4 dark:border-violet-800 dark:bg-violet-950/30">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-violet-700 dark:text-violet-300" />
            <p className="text-sm font-semibold text-violet-900 dark:text-violet-200">
              Voorstel: €{dispute.proposedRefund.toFixed(2)} terugbetaling
              {dispute.proposedRefund >= remainingRefundable - 0.005 && <span className="ml-1 text-xs font-normal">(= volledig)</span>}
            </p>
          </div>
          <p className="mt-1 text-xs text-violet-800 dark:text-violet-300">
            Voorgesteld door {dispute.proposedById === dispute.buyer.id ? dispute.buyer.displayName : dispute.seller.displayName}.
            {dispute.proposedById !== currentUserId && isParty ? " Je kunt accepteren, afwijzen of een tegenvoorstel doen." : " Wacht op antwoord van de andere partij."}
          </p>
          {dispute.proposedById !== currentUserId && isParty && (
            <div className="mt-3 flex flex-wrap gap-2">
              <ProposalAcceptButton disputeId={dispute.id} amount={dispute.proposedRefund} />
              <ProposalRejectButton disputeId={dispute.id} />
            </div>
          )}
        </section>
      )}

      {/* Party actions */}
      {sellerMustRespond && (
        <SellerResponseForm disputeId={dispute.id} maxRefund={remainingRefundable} allowProposal={dispute.status === "OPEN"} />
      )}

      {canPropose && <CounterProposalForm disputeId={dispute.id} maxRefund={remainingRefundable} />}

      {isOpen && isParty && (
        <AddEvidenceButton
          disputeId={dispute.id}
          existingCount={role === "buyer" ? dispute.evidenceBuyer.length : dispute.evidenceSeller.length}
          onUploaded={() => router.refresh()}
        />
      )}

      {(canEscalate || canWithdraw) && (
        <section className="dash-card p-4">
          <p className="text-sm font-semibold text-foreground">Andere opties</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {canEscalate && <RequestEscalationButton disputeId={dispute.id} />}
            {canWithdraw && <WithdrawButton disputeId={dispute.id} fundingSource={dispute.fundingSource} />}
          </div>
          {isParty && dispute.status === "OPEN" && (
            <p className="mt-2 text-xs text-muted-foreground">
              {role === "buyer"
                ? `De beheerder inschakelen kan zodra de verkoper heeft gereageerd. Reageert de verkoper niet vóór ${fmtDate(dispute.responseDeadline)}, dan win je automatisch.`
                : "Reageer eerst op het geschil; daarna kun je de beheerder inschakelen."}
            </p>
          )}
        </section>
      )}

      {/* Admin panel */}
      {role === "admin" && (
        <AdminPanel dispute={dispute} maxRefund={remainingRefundable} isOpen={isOpen} />
      )}

      {/* Timeline */}
      <section className="dash-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tijdlijn</p>
        <ol className="mt-3 space-y-2.5">
          {dispute.events.map((e) => {
            const internal = e.visibility === "INTERNAL";
            const isNote = e.type === "ADMIN_NOTE";
            return (
              <li key={e.id} className={`flex items-start gap-2 text-sm ${internal ? "rounded-md border border-dashed border-violet-300/60 bg-violet-50/30 p-2 dark:border-violet-800 dark:bg-violet-950/20" : ""}`}>
                <span className={`mt-1.5 inline-flex h-2 w-2 shrink-0 rounded-full ${e.actorType === "ADMIN" ? "bg-violet-500" : e.actorType === "SYSTEM" ? "bg-muted-foreground/40" : e.actorType === "BUYER" ? "bg-amber-500" : "bg-sky-500"}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-foreground ${isNote ? "whitespace-pre-wrap" : ""}`}>
                    {isNote && (
                      <span className="mr-1.5 inline-flex items-center gap-1 rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                        {internal ? <><Lock className="h-2.5 w-2.5" /> intern</> : <><MessageSquareText className="h-2.5 w-2.5" /> beheerder</>}
                      </span>
                    )}
                    {e.message ?? e.type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(e.createdAt, true)} · {e.actorType === "SYSTEM" ? "systeem" : e.actorType === "ADMIN" ? `beheerder${e.actorName ? ` ${e.actorName}` : ""}` : e.actorName ?? e.actorType.toLowerCase()}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

// ---------------- Sub-components ----------------

function PhotoStrip({ urls, altPrefix }: { urls: string[]; altPrefix: string }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {urls.map((url, i) => (
        <a key={`${url}-${i}`} href={url} target="_blank" rel="noopener noreferrer" className="block h-20 w-20 overflow-hidden rounded-md border border-border hover:opacity-80">
          <Image src={url} alt={`${altPrefix} ${i + 1}`} width={80} height={80} unoptimized className="h-full w-full object-cover" />
        </a>
      ))}
    </div>
  );
}

function SellerResponseForm({ disputeId, maxRefund, allowProposal }: { disputeId: string; maxRefund: number; allowProposal: boolean }) {
  const router = useRouter();
  const [statement, setStatement] = useState("");
  const [proposeRefund, setProposeRefund] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (statement.length < 20) {
      toast.error("Voer minimaal 20 tekens reactie in");
      return;
    }
    const parsed = proposeRefund && refundAmount ? parseFloat(refundAmount) : undefined;
    if (proposeRefund && (parsed === undefined || !isFinite(parsed) || parsed <= 0 || parsed > maxRefund)) {
      toast.error(`Voer een bedrag in tussen €0,01 en €${maxRefund.toFixed(2)}`);
      return;
    }
    setLoading(true);
    const result = await respondToDisputeV2({
      disputeId,
      sellerStatement: statement,
      evidenceUrls,
      proposedRefund: allowProposal ? parsed : undefined,
    });
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Reactie verstuurd");
    router.refresh();
  }

  return (
    <section className="rounded-dash border border-sky-300/60 bg-sky-50/40 p-4 dark:border-sky-800 dark:bg-sky-950/30">
      <p className="text-sm font-semibold text-sky-900 dark:text-sky-200">Reageer op het geschil</p>
      <p className="mt-1 text-xs text-sky-800 dark:text-sky-300">
        {allowProposal
          ? `Reageer binnen ${DISPUTE_V2_RESPONSE_DAYS} dagen — anders krijgt de koper automatisch het volledige bedrag terug. Foto's van het item vóór verzending en van de verpakking helpen enorm.`
          : "Het geschil ligt al bij de beheerder, maar je verklaring en foto's worden meegewogen."}
      </p>
      <textarea
        value={statement}
        onChange={(e) => setStatement(e.target.value)}
        placeholder="Leg uit wat er volgens jou aan de hand is..."
        rows={4}
        className="mt-3 block w-full glass-input px-3 py-2 text-sm text-foreground resize-none"
      />
      <p className="mt-1 text-xs text-muted-foreground">{statement.length}/20 minimaal</p>

      {allowProposal && (
        <>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={proposeRefund} onChange={(e) => setProposeRefund(e.target.checked)} />
            Stel direct een terugbetaling voor (snelste oplossing)
          </label>
          {proposeRefund && (
            <div className="mt-2">
              <input
                type="number"
                min="0.01"
                max={maxRefund}
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder={`Tussen €0,01 en €${maxRefund.toFixed(2)}`}
                className="block w-48 glass-input px-3 py-2 text-sm text-foreground"
              />
              <p className="mt-1 text-xs text-muted-foreground">€{maxRefund.toFixed(2)} = volledige terugbetaling; de bestelling wordt dan geannuleerd.</p>
            </div>
          )}
        </>
      )}

      <EvidenceUploadInline urls={evidenceUrls} onChange={setEvidenceUrls} />

      <div className="mt-4">
        <button
          onClick={submit}
          disabled={loading || statement.length < 20}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
        >
          {loading ? "Bezig..." : "Verstuur reactie"}
        </button>
      </div>
    </section>
  );
}

function CounterProposalForm({ disputeId, maxRefund }: { disputeId: string; maxRefund: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    const parsed = parseFloat(amount);
    if (!isFinite(parsed) || parsed <= 0 || parsed > maxRefund) {
      toast.error(`Voer een bedrag in tussen €0,01 en €${maxRefund.toFixed(2)}`);
      return;
    }
    setLoading(true);
    const result = await proposeRefundV2(disputeId, parsed);
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Voorstel verstuurd");
    setAmount("");
    router.refresh();
  }

  return (
    <section className="dash-card p-4">
      <p className="text-sm font-semibold text-foreground">Doe een (tegen)voorstel</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Maximaal €{maxRefund.toFixed(2)} (= volledige terugbetaling). De andere partij kan accepteren, afwijzen of een eigen voorstel doen; zonder reactie binnen {DISPUTE_V2_BUYER_REVIEW_DAYS} dagen gaat het geschil naar de beheerder.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          type="number"
          min="0.01"
          max={maxRefund}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`€0,01 – €${maxRefund.toFixed(2)}`}
          className="block w-48 glass-input px-3 py-2 text-sm text-foreground"
        />
        <button
          onClick={submit}
          disabled={loading || !amount}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
        >
          {loading ? "Bezig..." : "Stel voor"}
        </button>
      </div>
    </section>
  );
}

function ProposalAcceptButton({ disputeId, amount }: { disputeId: string; amount: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function submit() {
    if (!confirm(`Voorstel van €${amount.toFixed(2)} accepteren? Het geschil wordt direct afgerond en het geld wordt verrekend.`)) return;
    setLoading(true);
    const result = await acceptProposalV2(disputeId);
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Voorstel geaccepteerd — geschil afgerond");
    router.refresh();
  }
  return (
    <button onClick={submit} disabled={loading} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
      Accepteer €{amount.toFixed(2)}
    </button>
  );
}

function ProposalRejectButton({ disputeId }: { disputeId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function submit() {
    setLoading(true);
    const result = await rejectProposalV2(disputeId);
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Voorstel afgewezen");
    router.refresh();
  }
  return (
    <button onClick={submit} disabled={loading} className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50">
      Wijs af
    </button>
  );
}

function RequestEscalationButton({ disputeId }: { disputeId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function submit() {
    if (!confirm(`De beheerder inschakelen? Die beoordeelt alle informatie en beslist bindend, meestal binnen ${DISPUTE_V2_ADMIN_SLA_DAYS} dagen. Onderling oplossen is daarna niet meer mogelijk.`)) return;
    setLoading(true);
    const result = await requestEscalationV2(disputeId);
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Het geschil ligt nu bij de beheerder");
    router.refresh();
  }
  return (
    <button onClick={submit} disabled={loading} className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50">
      <Scale className="h-4 w-4" />
      {loading ? "Bezig..." : "Beheerder inschakelen"}
    </button>
  );
}

function WithdrawButton({ disputeId, fundingSource }: { disputeId: string; fundingSource: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function submit() {
    if (!confirm(fundingSource === "ESCROW"
      ? "Geschil intrekken? Het bedrag in bewaring wordt dan aan de verkoper uitbetaald en het geschil kan niet opnieuw geopend worden."
      : "Geschil intrekken? Het geschil wordt gesloten zonder terugbetaling en kan niet opnieuw geopend worden.")) return;
    setLoading(true);
    const result = await withdrawDisputeV2(disputeId);
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Geschil ingetrokken");
    router.refresh();
  }
  return (
    <button onClick={submit} disabled={loading} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50">
      <Undo2 className="h-4 w-4" />
      {loading ? "Bezig..." : "Geschil intrekken (opgelost)"}
    </button>
  );
}

function AddEvidenceButton({ disputeId, existingCount, onUploaded }: { disputeId: string; existingCount: number; onUploaded: () => void }) {
  const [urls, setUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const room = Math.max(0, DISPUTE_V2_MAX_EVIDENCE_PER_PARTY - existingCount);

  async function submit() {
    if (urls.length === 0) return;
    setLoading(true);
    const result = await addEvidenceV2({ disputeId, urls });
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Bewijs toegevoegd");
    setUrls([]);
    onUploaded();
  }

  if (room === 0) return null;

  return (
    <section className="dash-card p-4">
      <p className="text-sm font-semibold text-foreground">Voeg extra foto&apos;s toe</p>
      <p className="mt-1 text-xs text-muted-foreground">Nog {room} foto(&apos;s) mogelijk. Foto&apos;s blijven zichtbaar voor beide partijen en de beheerder.</p>
      <EvidenceUploadInline urls={urls} onChange={setUrls} max={room} />
      {urls.length > 0 && (
        <button
          onClick={submit}
          disabled={loading}
          className="mt-3 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
        >
          {loading ? "Bezig..." : `Upload ${urls.length} foto('s)`}
        </button>
      )}
    </section>
  );
}

// ---------------- Admin ----------------

function AdminPanel({ dispute, maxRefund, isOpen }: { dispute: DisputeV2DetailData; maxRefund: number; isOpen: boolean }) {
  return (
    <section className="space-y-4 rounded-dash border border-violet-300/60 bg-violet-50/30 p-4 dark:border-violet-800 dark:bg-violet-950/20">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-violet-700 dark:text-violet-300" />
        <p className="text-sm font-semibold text-violet-900 dark:text-violet-200">Beheerder</p>
      </div>

      {isOpen && dispute.status !== "ESCALATED" && <TakeOverButton disputeId={dispute.id} />}

      <AdminNoteForm disputeId={dispute.id} />

      {isOpen && <AdminResolveForm disputeId={dispute.id} maxRefund={maxRefund} fundingSource={dispute.fundingSource} status={dispute.status} />}
    </section>
  );
}

function TakeOverButton({ disputeId }: { disputeId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit() {
    setLoading(true);
    const result = await adminTakeOverDisputeV2({ disputeId, reason: reason || undefined });
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Geschil overgenomen");
    router.refresh();
  }
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-sm font-medium text-foreground">Overnemen</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Haalt het geschil uit de onderlinge fase; beide partijen krijgen een melding en kunnen nog bewijs toevoegen.</p>
      <div className="mt-2 flex gap-2">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reden (zichtbaar voor beide partijen, optioneel)"
          className="glass-input flex-1 px-3 py-1.5 text-sm text-foreground"
        />
        <button onClick={submit} disabled={loading} className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">
          {loading ? "Bezig..." : "Neem over"}
        </button>
      </div>
    </div>
  );
}

function AdminNoteForm({ disputeId }: { disputeId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [visibility, setVisibility] = useState<DisputeV2NoteVisibility>("INTERNAL");
  const [loading, setLoading] = useState(false);
  async function submit() {
    if (message.trim().length < 3) return;
    setLoading(true);
    const result = await adminAddDisputeNoteV2({ disputeId, message, visibility });
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success(visibility === "INTERNAL" ? "Interne notitie opgeslagen" : "Bericht naar beide partijen gestuurd");
    setMessage("");
    router.refresh();
  }
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-sm font-medium text-foreground">Notitie of vraag</p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        placeholder="Interne notitie (alleen beheerders) of een vraag/bericht aan beide partijen…"
        className="mt-2 block w-full glass-input px-3 py-2 text-sm text-foreground resize-none"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-foreground">
          <input type="radio" name={`vis-${disputeId}`} checked={visibility === "INTERNAL"} onChange={() => setVisibility("INTERNAL")} />
          <Lock className="h-3 w-3" /> Intern
        </label>
        <label className="flex items-center gap-1.5 text-xs text-foreground">
          <input type="radio" name={`vis-${disputeId}`} checked={visibility === "PARTIES"} onChange={() => setVisibility("PARTIES")} />
          <MessageSquareText className="h-3 w-3" /> Naar beide partijen (met melding)
        </label>
        <button onClick={submit} disabled={loading || message.trim().length < 3} className="ml-auto rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50">
          {loading ? "Bezig..." : "Plaats"}
        </button>
      </div>
    </div>
  );
}

function AdminResolveForm({ disputeId, maxRefund, fundingSource, status }: { disputeId: string; maxRefund: number; fundingSource: string; status: string }) {
  const router = useRouter();
  const [resolution, setResolution] = useState<DisputeV2Resolution | "">("");
  const [refundAmount, setRefundAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const helper: Record<DisputeV2Resolution, string> = {
    FULL_REFUND: `Koper krijgt €${maxRefund.toFixed(2)} terug (+ eventuele veilingkosten); bestelling wordt geannuleerd.${fundingSource === "SELLER_BALANCE" ? " Bedrag komt uit het verkoperssaldo; een tekort schiet het platform voor en wordt bij de verkoper geboekt." : ""}`,
    PARTIAL_REFUND: `Koper krijgt een deel terug${fundingSource === "ESCROW" ? ", de rest gaat naar de verkoper (commissie alleen over het item-deel)" : ""}; bestelling telt als afgerond.`,
    NO_REFUND: fundingSource === "ESCROW" ? "Geen terugbetaling; het bedrag in bewaring gaat naar de verkoper." : "Geen terugbetaling; er verandert niets aan de saldo's.",
    RETURN_AND_REFUND: "Zelfde geldstroom als volledige terugbetaling. Gebruik dit als je met de koper afspreekt dat het item teruggaat — regel de retour via een bericht aan beide partijen.",
  };

  async function submit() {
    if (!resolution || notes.length < 20) return;
    const parsed = resolution === "PARTIAL_REFUND" ? parseFloat(refundAmount) : undefined;
    if (resolution === "PARTIAL_REFUND" && (parsed === undefined || !isFinite(parsed) || parsed <= 0 || parsed >= maxRefund)) {
      toast.error(`Bedrag moet tussen €0,01 en €${(maxRefund - 0.01).toFixed(2)} liggen (voor het volledige bedrag: kies volledige terugbetaling)`);
      return;
    }
    if (!confirm(`Beslissing vastleggen: ${DISPUTE_V2_RESOLUTION_LABELS[resolution]}${parsed ? ` (€${parsed.toFixed(2)})` : ""}? Dit is definitief en wordt direct verrekend.`)) return;
    setLoading(true);
    const result = await adminResolveDisputeV2({
      disputeId,
      resolution: resolution as DisputeV2Resolution,
      refundAmount: parsed,
      adminNotes: notes,
    });
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Geschil beslist");
    router.refresh();
  }

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <Gavel className="h-4 w-4 text-violet-700 dark:text-violet-300" />
        <p className="text-sm font-medium text-foreground">Beslissen{status !== "ESCALATED" ? " (neemt het geschil direct over)" : ""}</p>
      </div>
      <div className="mt-3">
        <label className="block text-sm font-medium text-foreground">Uitkomst</label>
        <select
          value={resolution}
          onChange={(e) => setResolution(e.target.value as DisputeV2Resolution | "")}
          className="mt-1 block w-full glass-input px-3 py-2 text-sm text-foreground"
        >
          <option value="">Kies een uitkomst</option>
          {DISPUTE_V2_RESOLUTIONS.map((r) => (
            <option key={r} value={r}>{DISPUTE_V2_RESOLUTION_LABELS[r]}</option>
          ))}
        </select>
        {resolution && <p className="mt-1 text-xs text-muted-foreground">{helper[resolution]}</p>}
      </div>
      {resolution === "PARTIAL_REFUND" && (
        <div className="mt-3">
          <label className="block text-sm font-medium text-foreground">Terug te betalen bedrag (max €{(maxRefund - 0.01).toFixed(2)})</label>
          <input
            type="number"
            min="0.01"
            max={maxRefund}
            step="0.01"
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
            className="mt-1 block w-48 glass-input px-3 py-2 text-sm text-foreground"
          />
        </div>
      )}
      <div className="mt-3">
        <label className="block text-sm font-medium text-foreground">Onderbouwing (min. 20 tekens — beide partijen lezen dit)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Wat heb je beoordeeld, en waarom is dit de uitkomst?"
          className="mt-1 block w-full glass-input px-3 py-2 text-sm text-foreground resize-none"
        />
        <p className="mt-1 text-xs text-muted-foreground">{notes.length}/20 minimaal</p>
      </div>
      <button
        onClick={submit}
        disabled={loading || !resolution || notes.length < 20}
        className="mt-3 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
      >
        {loading ? "Bezig..." : "Beslissing vastleggen"}
      </button>
    </div>
  );
}

function EvidenceUploadInline({ urls, onChange, max = 6 }: { urls: string[]; onChange: (u: string[]) => void; max?: number }) {
  const [uploading, setUploading] = useState(false);

  async function uploadFiles(files: FileList | File[]) {
    const fileArray = Array.from(files);
    const remaining = max - urls.length;
    if (remaining <= 0) return;
    const toUpload = fileArray.slice(0, remaining);
    setUploading(true);
    const formData = new FormData();
    toUpload.forEach((f) => formData.append("files", f));
    formData.append("context", "dispute");
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.urls?.length) onChange([...urls, ...data.urls]);
      if (data.errors?.length) for (const err of data.errors) toast.error(err);
    } catch {
      toast.error("Upload mislukt");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urls.map((url, i) => (
            <div key={url} className="group relative h-16 w-16 overflow-hidden rounded-md bg-muted">
              <Image src={url} alt={`Bewijs ${i + 1}`} fill unoptimized className="object-cover" sizes="64px" />
              <button
                type="button"
                onClick={() => onChange(urls.filter((_, idx) => idx !== i))}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {urls.length < max && (
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(e) => e.target.files && uploadFiles(e.target.files)}
          />
          <Upload className="h-4 w-4" />
          {uploading ? "..." : `${urls.length}/${max}`}
        </label>
      )}
    </div>
  );
}
