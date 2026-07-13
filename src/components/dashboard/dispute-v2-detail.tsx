"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Upload, X, AlertTriangle, ShieldCheck, Scale, ExternalLink } from "lucide-react";
import {
  respondToDisputeV2,
  proposeRefundV2,
  acceptProposalV2,
  rejectProposalV2,
  requestEscalationV2,
  addEvidenceV2,
  adminResolveDisputeV2,
} from "@/actions/dispute-v2";
import {
  DISPUTE_V2_RESOLUTIONS,
  type DisputeV2Resolution,
} from "@/lib/dispute-v2/config";

type DisputeEvent = {
  id: string;
  type: string;
  actorType: string;
  actorId: string | null;
  message: string | null;
  createdAt: string;
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
    trackingUrl: string | null;
    shippingProofUrls: string[];
  };
  events: DisputeEvent[];
};

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  OPEN: { label: "Open — wacht op verkoper", tone: "amber" },
  SELLER_RESPONDED: { label: "Verkoper heeft gereageerd", tone: "sky" },
  MEDIATION: { label: "Voorstel uitstaand", tone: "violet" },
  ESCALATED: { label: "Geëscaleerd naar admin", tone: "rose" },
  RESOLVED_BUYER: { label: "Afgerond — koper kreeg refund", tone: "emerald" },
  RESOLVED_SELLER: { label: "Afgerond — geen refund", tone: "slate" },
  RESOLVED_MUTUAL: { label: "Afgerond via mutual akkoord", tone: "emerald" },
  RESOLVED_ADMIN: { label: "Afgerond door admin", tone: "emerald" },
  CANCELLED: { label: "Ingetrokken", tone: "slate" },
};

const RESOLUTION_LABELS: Record<DisputeV2Resolution, string> = {
  FULL_REFUND: "Volledige refund",
  PARTIAL_REFUND: "Gedeeltelijke refund",
  NO_REFUND: "Geen refund",
  RETURN_AND_REFUND: "Retour + refund",
};

function toneClass(tone: string): string {
  switch (tone) {
    case "amber": return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
    case "sky": return "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300";
    case "violet": return "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300";
    case "rose": return "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
    case "emerald": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
    case "slate":
    default: return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
}

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
  const statusMeta = STATUS_LABELS[dispute.status] ?? { label: dispute.status, tone: "slate" };

  const remainingRefundable = dispute.bundle.totalCost - dispute.bundle.refundedAmount;
  const isOpen = ["OPEN", "SELLER_RESPONDED", "MEDIATION", "ESCALATED"].includes(dispute.status);

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Geschil</span>
          <span className="font-mono">{dispute.id.slice(0, 8)}</span>
          <span>·</span>
          <span>Bestelling {dispute.bundle.orderNumber}</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold text-foreground">
          {RESOLUTION_LABELS[dispute.resolution as DisputeV2Resolution] ?? "Geschil in behandeling"}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClass(statusMeta.tone)}`}>
            {statusMeta.label}
          </span>
          <span className="text-xs text-muted-foreground">
            Aangemaakt {new Date(dispute.createdAt).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
          </span>
        </div>
      </header>

      {/* Bundle context */}
      <section className="rounded-xl border border-border bg-card shadow-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bestelling</p>
        <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
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
              {dispute.bundle.refundedAmount > 0 && (
                <span className="ml-2 text-xs text-emerald-700 dark:text-emerald-400">
                  (€{dispute.bundle.refundedAmount.toFixed(2)} reeds refunded)
                </span>
              )}
            </p>
          </div>
          {dispute.bundle.trackingUrl && (
            <div>
              <p className="text-muted-foreground">Tracking</p>
              <a href={dispute.bundle.trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                <ExternalLink className="h-3 w-3" /> Volg pakket
              </a>
            </div>
          )}
        </div>

        {dispute.bundle.shippingProofUrls.length > 0 && (role === "admin" || role === "buyer") && (
          <div className="mt-3 rounded-md border border-sky-200/60 bg-sky-50/40 p-3 dark:border-sky-900/40 dark:bg-sky-950/20">
            <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">Verzend-bewijs verkoper ({dispute.bundle.shippingProofUrls.length})</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {dispute.bundle.shippingProofUrls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block h-16 w-16 overflow-hidden rounded-md border border-border hover:opacity-80">
                  <Image src={url} alt={`Verzend ${i + 1}`} width={64} height={64} className="h-full w-full object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Buyer's statement */}
      <section className="rounded-xl border border-amber-200/60 bg-amber-50/40 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          Koper — {dispute.buyer.displayName} · reden: {dispute.reasonCategory.toLowerCase().replace(/_/g, " ")}
        </p>
        <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">{dispute.buyerStatement}</p>
        {dispute.evidenceBuyer.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {dispute.evidenceBuyer.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block h-16 w-16 overflow-hidden rounded-md border border-border hover:opacity-80">
                <Image src={url} alt={`Koper-bewijs ${i + 1}`} width={64} height={64} className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        )}
      </section>

      {/* Seller's response */}
      {dispute.sellerStatement && (
        <section className="rounded-xl border border-blue-200/60 bg-blue-50/40 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
            Verkoper — {dispute.seller.displayName}
          </p>
          <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">{dispute.sellerStatement}</p>
          {dispute.evidenceSeller.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {dispute.evidenceSeller.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block h-16 w-16 overflow-hidden rounded-md border border-border hover:opacity-80">
                  <Image src={url} alt={`Verkoper-bewijs ${i + 1}`} width={64} height={64} className="h-full w-full object-cover" />
                </a>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Admin notes (visible to all when resolved) */}
      {dispute.adminNotes && (
        <section className="rounded-xl border border-violet-200/60 bg-violet-50/40 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
            Admin — {RESOLUTION_LABELS[dispute.resolution as DisputeV2Resolution] ?? dispute.resolution}
            {dispute.finalRefund !== null && dispute.finalRefund > 0 && (
              <> · €{dispute.finalRefund.toFixed(2)} refund</>
            )}
          </p>
          <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">{dispute.adminNotes}</p>
        </section>
      )}

      {/* Active proposal */}
      {dispute.status === "MEDIATION" && dispute.proposedRefund !== null && (
        <section className="rounded-xl border border-violet-300/60 bg-violet-50/50 p-4 dark:border-violet-800 dark:bg-violet-950/30">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-violet-700 dark:text-violet-300" />
            <p className="text-sm font-semibold text-violet-900 dark:text-violet-200">
              Refund-voorstel: €{dispute.proposedRefund.toFixed(2)}
            </p>
          </div>
          <p className="mt-1 text-xs text-violet-800 dark:text-violet-300">
            Voorgesteld door {dispute.proposedById === dispute.buyer.id ? dispute.buyer.displayName : dispute.seller.displayName}.
            {dispute.proposedById !== currentUserId && role !== "admin" ? " Je kunt accepteren, afwijzen of een tegenvoorstel doen." : " Wacht op antwoord van de andere partij."}
          </p>
          {dispute.proposedById !== currentUserId && (role === "buyer" || role === "seller") && (
            <div className="mt-3 flex flex-wrap gap-2">
              <ProposalAcceptButton disputeId={dispute.id} amount={dispute.proposedRefund} />
              <ProposalRejectButton disputeId={dispute.id} />
            </div>
          )}
        </section>
      )}

      {/* Action sections per role + status */}
      {role === "seller" && dispute.status === "OPEN" && (
        <SellerResponseForm disputeId={dispute.id} maxRefund={remainingRefundable} />
      )}

      {(role === "buyer" || role === "seller") && (dispute.status === "SELLER_RESPONDED" || dispute.status === "MEDIATION") && dispute.proposedById !== currentUserId && (
        <CounterProposalForm disputeId={dispute.id} maxRefund={remainingRefundable} />
      )}

      {role === "admin" && dispute.status === "ESCALATED" && (
        <AdminResolveForm disputeId={dispute.id} maxRefund={remainingRefundable} />
      )}

      {isOpen && (role === "buyer" || role === "seller") && dispute.status !== "ESCALATED" && (
        <AddEvidenceButton disputeId={dispute.id} onUploaded={() => router.refresh()} />
      )}

      {(role === "buyer" || role === "seller") && isOpen && dispute.status !== "ESCALATED" && (
        <RequestEscalationButton disputeId={dispute.id} />
      )}

      {/* Timeline */}
      <section className="rounded-xl border border-border bg-card shadow-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tijdlijn</p>
        <ol className="mt-3 space-y-2">
          {dispute.events.map((e) => (
            <li key={e.id} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 inline-flex h-2 w-2 shrink-0 rounded-full bg-muted-foreground/60" />
              <div className="min-w-0 flex-1">
                <p className="text-foreground">{e.message ?? e.type}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(e.createdAt).toLocaleString("nl-NL")} · {e.actorType.toLowerCase()}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

// ---------------- Sub-components ----------------

function SellerResponseForm({ disputeId, maxRefund }: { disputeId: string; maxRefund: number }) {
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
    setLoading(true);
    const result = await respondToDisputeV2({
      disputeId,
      sellerStatement: statement,
      evidenceUrls,
      proposedRefund: proposeRefund && refundAmount ? parseFloat(refundAmount) : undefined,
    });
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Reactie verstuurd");
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-sky-300/60 bg-sky-50/40 p-4 dark:border-sky-800 dark:bg-sky-950/30">
      <p className="text-sm font-semibold text-sky-900 dark:text-sky-200">Reageer op het geschil</p>
      <p className="mt-1 text-xs text-sky-800 dark:text-sky-300">
        Reageer binnen 14 dagen — anders krijgt de koper automatisch het volledige bedrag terug.
      </p>
      <textarea
        value={statement}
        onChange={(e) => setStatement(e.target.value)}
        placeholder="Leg uit wat er volgens jou aan de hand is..."
        rows={4}
        className="mt-3 block w-full glass-input px-3 py-2 text-sm text-foreground resize-none"
      />
      <p className="mt-1 text-xs text-muted-foreground">{statement.length}/20 minimaal</p>

      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={proposeRefund} onChange={(e) => setProposeRefund(e.target.checked)} />
        Stel direct een refund voor (snellere oplossing)
      </label>
      {proposeRefund && (
        <div className="mt-2">
          <input
            type="number"
            min="0"
            max={maxRefund}
            step="0.01"
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
            placeholder={`Tussen €0,01 en €${maxRefund.toFixed(2)}`}
            className="block w-48 glass-input px-3 py-2 text-sm text-foreground"
          />
        </div>
      )}

      <EvidenceUploadInline urls={evidenceUrls} onChange={setEvidenceUrls} />

      <div className="mt-4">
        <button
          onClick={submit}
          disabled={loading || statement.length < 20}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
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
    if (!isFinite(parsed) || parsed < 0 || parsed > maxRefund) {
      toast.error(`Voer een bedrag in tussen €0 en €${maxRefund.toFixed(2)}`);
      return;
    }
    setLoading(true);
    const result = await proposeRefundV2(disputeId, parsed);
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Voorstel verstuurd");
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold text-foreground">Doe een (tegen-)voorstel</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Maximum refund: €{maxRefund.toFixed(2)}. Andere partij kan accepteren, afwijzen of een eigen voorstel doen.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          type="number"
          min="0"
          max={maxRefund}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`€0,00 – €${maxRefund.toFixed(2)}`}
          className="block w-48 glass-input px-3 py-2 text-sm text-foreground"
        />
        <button
          onClick={submit}
          disabled={loading || !amount}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
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
    setLoading(true);
    const result = await acceptProposalV2(disputeId);
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Voorstel geaccepteerd — geschil opgelost");
    router.refresh();
  }
  return (
    <button onClick={submit} disabled={loading} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
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
    <button onClick={submit} disabled={loading} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50">
      Wijs af
    </button>
  );
}

function RequestEscalationButton({ disputeId }: { disputeId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function submit() {
    if (!confirm("Vraag admin-beoordeling aan? Pas bij dubbel akkoord van koper én verkoper neemt admin het over (max 5d SLA).")) return;
    setLoading(true);
    const result = await requestEscalationV2(disputeId);
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success(result.escalated ? "Beide partijen akkoord — naar admin" : "Verzoek tot escalatie gestuurd; wacht op andere partij");
    router.refresh();
  }
  return (
    <section className="rounded-xl border border-rose-200/60 bg-rose-50/40 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
      <div className="flex items-start gap-3">
        <Scale className="h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-rose-900 dark:text-rose-200">Niet eens? Vraag admin-beoordeling aan</p>
          <p className="mt-1 text-xs text-rose-800 dark:text-rose-300">
            Wanneer beide partijen om escalatie vragen, neemt admin het over (max 5 dagen SLA).
          </p>
          <button onClick={submit} disabled={loading} className="mt-2 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50">
            {loading ? "Bezig..." : "Vraag escalatie aan"}
          </button>
        </div>
      </div>
    </section>
  );
}

function AddEvidenceButton({ disputeId, onUploaded }: { disputeId: string; onUploaded: () => void }) {
  const [urls, setUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

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

  return (
    <section className="rounded-xl border border-border bg-card shadow-card p-4">
      <p className="text-sm font-semibold text-foreground">Voeg extra bewijs toe</p>
      <EvidenceUploadInline urls={urls} onChange={setUrls} />
      {urls.length > 0 && (
        <button
          onClick={submit}
          disabled={loading}
          className="mt-3 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
        >
          {loading ? "Bezig..." : `Upload ${urls.length} foto('s)`}
        </button>
      )}
    </section>
  );
}

function AdminResolveForm({ disputeId, maxRefund }: { disputeId: string; maxRefund: number }) {
  const router = useRouter();
  const [resolution, setResolution] = useState<DisputeV2Resolution | "">("");
  const [refundAmount, setRefundAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!resolution || notes.length < 20) return;
    setLoading(true);
    const result = await adminResolveDisputeV2({
      disputeId,
      resolution: resolution as DisputeV2Resolution,
      refundAmount: resolution === "PARTIAL_REFUND" ? parseFloat(refundAmount) : undefined,
      adminNotes: notes,
    });
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Geschil afgerond");
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-violet-300/60 bg-violet-50/40 p-4 dark:border-violet-800 dark:bg-violet-950/30">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-violet-700 dark:text-violet-300" />
        <p className="text-sm font-semibold text-violet-900 dark:text-violet-200">Admin-beoordeling</p>
      </div>
      <div className="mt-3">
        <label className="block text-sm font-medium text-foreground">Resolutie</label>
        <select
          value={resolution}
          onChange={(e) => setResolution(e.target.value as DisputeV2Resolution | "")}
          className="mt-1 block w-full glass-input px-3 py-2 text-sm text-foreground"
        >
          <option value="">Kies een uitkomst</option>
          {DISPUTE_V2_RESOLUTIONS.map((r) => (
            <option key={r} value={r}>{RESOLUTION_LABELS[r]}</option>
          ))}
        </select>
      </div>
      {resolution === "PARTIAL_REFUND" && (
        <div className="mt-3">
          <label className="block text-sm font-medium text-foreground">Refund-bedrag (max €{maxRefund.toFixed(2)})</label>
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
        <label className="block text-sm font-medium text-foreground">Admin-onderbouwing (min 20 tekens)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="mt-1 block w-full glass-input px-3 py-2 text-sm text-foreground resize-none"
        />
        <p className="mt-1 text-xs text-muted-foreground">{notes.length}/20 minimaal — beide partijen zien deze tekst.</p>
      </div>
      <button
        onClick={submit}
        disabled={loading || !resolution || notes.length < 20}
        className="mt-3 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
      >
        {loading ? "Bezig..." : "Rond geschil af"}
      </button>
    </section>
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
            <div key={url} className="group relative h-16 w-16 overflow-hidden rounded-lg bg-muted">
              <Image src={url} alt={`Bewijs ${i + 1}`} fill className="object-cover" sizes="64px" />
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
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors">
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
