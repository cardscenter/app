"use client";

import { useTranslations, useLocale } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import {
  respondToDispute,
  acceptSellerResponse,
  rejectAndResolve,
  proposeMutualResolution,
  acceptMutualResolution,
  requestEscalation,
  withdrawProposal,
} from "@/actions/dispute";
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  ArrowLeft,
  Package,
  Info,
  Scale,
  HelpCircle,
  HandCoins,
  Upload,
  X,
} from "lucide-react";
import Image from "next/image";

type BundleItem = {
  id: string;
  cardName: string;
  condition: string;
  price: number;
  imageUrl: string | null;
};

type DisputeData = {
  id: string;
  reason: string;
  description: string;
  evidenceUrls: string[];
  sellerResponse: string | null;
  sellerEvidenceUrls: string[];
  sellerRespondedAt: string | null;
  status: string;
  resolution: string | null;
  partialRefundAmount: number | null;
  proposedById: string | null;
  resolvedAt: string | null;
  resolvedById: string | null;
  adminNotes: string | null;
  buyerAcceptsEscalation: boolean;
  sellerAcceptsEscalation: boolean;
  responseDeadline: string;
  buyerReviewDeadline: string | null;
  events: {
    id: string;
    type: string;
    actorId: string;
    detail: string | null;
    createdAt: string;
  }[];
  createdAt: string;
  bundle: {
    id: string;
    totalCost: number;
    totalItemCost: number;
    shippingCost: number;
    trackingUrl: string | null;
    shippedAt: string | null;
    buyerName: string;
    buyerId: string;
    sellerName: string;
    sellerId: string;
    shippingMethodCarrier: string | null;
    shippingMethodService: string | null;
    sourceTitle: string | null;
    items: BundleItem[];
  };
  isBuyer: boolean;
  isSeller: boolean;
};

const REASON_KEYS: Record<string, string> = {
  NOT_RECEIVED: "reasonNotReceived",
  NOT_AS_DESCRIBED: "reasonNotAsDescribed",
  DAMAGED_IN_TRANSIT: "reasonDamagedInTransit",
};

const STATUS_BADGE: Record<string, string> = {
  OPEN: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  SELLER_RESPONDED: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  RESOLVED_BUYER: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  RESOLVED_SELLER: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  RESOLVED_MUTUAL: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  ESCALATED: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
};

const STATUS_KEYS: Record<string, string> = {
  OPEN: "statusOpen",
  SELLER_RESPONDED: "statusSellerResponded",
  RESOLVED_BUYER: "statusResolvedBuyer",
  RESOLVED_SELLER: "statusResolvedSeller",
  RESOLVED_MUTUAL: "statusResolvedMutual",
  ESCALATED: "statusEscalated",
};

function getStatusLabel(dispute: DisputeData, t: ReturnType<typeof useTranslations>) {
  if (dispute.resolution === "ADMIN_DECISION") return t("statusResolvedAdmin");
  return t(STATUS_KEYS[dispute.status] ?? "statusOpen");
}

function getStatusBadgeClass(dispute: DisputeData) {
  if (dispute.resolution === "ADMIN_DECISION") return "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400";
  return STATUS_BADGE[dispute.status] ?? "";
}

export function DisputeDetailContent({ dispute }: { dispute: DisputeData }) {
  const t = useTranslations("disputes");
  const locale = useLocale();
  const router = useRouter();

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === "nl" ? "nl-NL" : "en-GB", {
      day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
    });

  const isResolved = dispute.status.startsWith("RESOLVED_");
  const isEscalated = dispute.status === "ESCALATED";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/geschillen"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("title")}
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground">
            {t(REASON_KEYS[dispute.reason] ?? "reasonNotReceived")}
          </h1>
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(dispute)}`}>
            {getStatusLabel(dispute, t)}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {dispute.isBuyer
            ? `${t("asBuyer")} — ${dispute.bundle.sellerName}`
            : `${t("asSeller")} — ${dispute.bundle.buyerName}`}
        </p>
      </div>

      {/* What happens next — contextual help */}
      {!isResolved && (
        <div className="glass rounded-xl p-4 border-l-4 border-l-blue-400 dark:border-l-blue-500">
          <div className="flex items-start gap-3">
            <HelpCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">{t("whatHappensNext")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {dispute.status === "OPEN" && t("explainOpen")}
                {dispute.status === "SELLER_RESPONDED" && t("explainResponded")}
                {dispute.status === "ESCALATED" && t("explainEscalated")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Admin decision notes */}
      {isResolved && dispute.resolution === "ADMIN_DECISION" && dispute.adminNotes && (
        <div className="glass rounded-xl p-4 border-l-4 border-l-purple-400 dark:border-l-purple-500">
          <div className="flex items-start gap-3">
            <Scale className="h-5 w-5 text-purple-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">{t("adminDecision")}</p>
              <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{dispute.adminNotes}</p>
            </div>
          </div>
        </div>
      )}

      {/* Order info */}
      <div className="glass rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Package className="h-4 w-4" />
          {t("bundleInfo")}
        </h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">{t("reason")}: </span>
            <span className="font-medium text-foreground">{t(REASON_KEYS[dispute.reason])}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t("totalLabel")}: </span>
            <span className="font-medium text-foreground">&euro;{dispute.bundle.totalCost.toFixed(2)}</span>
          </div>
          {dispute.bundle.trackingUrl && (
            <div className="col-span-2">
              <a
                href={dispute.bundle.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t("trackingLink")}
              </a>
            </div>
          )}
        </div>

        {dispute.bundle.items.length > 0 && (
          <div className="divide-y divide-border/50 border-t border-border/50 pt-3">
            {dispute.bundle.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-2">
                {item.imageUrl ? (
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                    <Image src={item.imageUrl} alt={item.cardName} fill className="object-cover" sizes="40px" />
                  </div>
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-muted" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.cardName}</p>
                  <p className="text-xs text-muted-foreground">{item.condition}</p>
                </div>
                <span className="text-sm text-foreground">&euro;{item.price.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="glass rounded-xl p-4 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">{t("timeline")}</h2>

        {dispute.events.length > 0 ? (
          /* Event-based timeline */
          <>
            {/* Always show the OPENED item, even if no OPENED event exists (e.g. seeded data) */}
            {!dispute.events.some((e) => e.type === "OPENED") && (
              <TimelineItem
                icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
                title={dispute.isBuyer ? t("timelineOpenedSelf") : t("timelineOpenedOther", { name: dispute.bundle.buyerName })}
                date={formatDate(dispute.createdAt)}
                description={dispute.description}
                evidenceUrls={dispute.evidenceUrls}
              />
            )}
            {/* Always show the SELLER_RESPONDED item if seller has responded but no event exists */}
            {dispute.sellerResponse && !dispute.events.some((e) => e.type === "SELLER_RESPONDED") && (
              <TimelineItem
                icon={<MessageCircle className="h-4 w-4 text-blue-500" />}
                title={dispute.isSeller ? t("timelineRespondedSelf") : t("timelineRespondedOther", { name: dispute.bundle.sellerName })}
                date={dispute.sellerRespondedAt ? formatDate(dispute.sellerRespondedAt) : ""}
                description={dispute.sellerResponse}
                evidenceUrls={dispute.sellerEvidenceUrls}
              />
            )}
            {dispute.events.map((event) => {
              const isSelf = (dispute.isBuyer && event.actorId === dispute.bundle.buyerId) ||
                (dispute.isSeller && event.actorId === dispute.bundle.sellerId);
              const actorName = event.actorId === dispute.bundle.buyerId
                ? dispute.bundle.buyerName
                : dispute.bundle.sellerName;

              return (
                <TimelineItem
                  key={event.id}
                  icon={getEventIcon(event.type)}
                  title={getEventTitle(event, isSelf, actorName, t)}
                  date={formatDate(event.createdAt)}
                  description={getEventDescription(event, dispute, t)}
                  evidenceUrls={getEventEvidence(event, dispute)}
                />
              );
            })}
            {/* Waiting for seller response */}
            {!dispute.sellerResponse && !isResolved && !isEscalated && (
              <div className="flex items-start gap-3 pl-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t("noResponse")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("respondDeadline", { date: formatDate(dispute.responseDeadline) })}
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Fallback: static timeline for disputes without events */
          <>
            <TimelineItem
              icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
              title={dispute.isBuyer ? t("timelineOpenedSelf") : t("timelineOpenedOther", { name: dispute.bundle.buyerName })}
              date={formatDate(dispute.createdAt)}
              description={dispute.description}
              evidenceUrls={dispute.evidenceUrls}
            />
            {dispute.sellerResponse ? (
              <TimelineItem
                icon={<MessageCircle className="h-4 w-4 text-blue-500" />}
                title={dispute.isSeller ? t("timelineRespondedSelf") : t("timelineRespondedOther", { name: dispute.bundle.sellerName })}
                date={dispute.sellerRespondedAt ? formatDate(dispute.sellerRespondedAt) : ""}
                description={dispute.sellerResponse}
                evidenceUrls={dispute.sellerEvidenceUrls}
              />
            ) : !isResolved && !isEscalated && (
              <div className="flex items-start gap-3 pl-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t("noResponse")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("respondDeadline", { date: formatDate(dispute.responseDeadline) })}
                  </p>
                </div>
              </div>
            )}
            {isEscalated && (
              <TimelineItem
                icon={<Scale className="h-4 w-4 text-purple-500" />}
                title={t("timelineEscalated")}
                date=""
                description={t("escalateBothAccepted")}
              />
            )}
            {isResolved && (
              <TimelineItem
                icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
                title={t("timelineResolved")}
                date={dispute.resolvedAt ? formatDate(dispute.resolvedAt) : ""}
                description={getResolutionText(dispute, t)}
              />
            )}
          </>
        )}
      </div>

      {/* Actions — only if not resolved */}
      {!isResolved && !isEscalated && (
        <DisputeActions dispute={dispute} router={router} />
      )}

      {/* Escalation panel — show when escalated but not resolved */}
      {isEscalated && !isResolved && (
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
            <Scale className="h-5 w-5" />
            <p className="text-sm font-semibold">{t("statusEscalated")}</p>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{t("explainEscalated")}</p>
        </div>
      )}
    </div>
  );
}

function getResolutionText(dispute: DisputeData, t: ReturnType<typeof useTranslations>) {
  if (dispute.resolution === "ADMIN_DECISION") return t("resolutionAdmin");
  if (dispute.resolution === "REFUND_FULL") return t("resolutionFullRefund");
  if (dispute.resolution === "NO_REFUND") return t("resolutionNoRefund");
  if (dispute.resolution === "REFUND_PARTIAL" || dispute.resolution === "MUTUAL_AGREEMENT") {
    return t("resolutionPartialRefund", { amount: `€${dispute.partialRefundAmount?.toFixed(2) ?? "0.00"}` });
  }
  return t("resolutionNoRefund");
}

function getEventIcon(type: string) {
  switch (type) {
    case "OPENED":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case "SELLER_RESPONDED":
      return <MessageCircle className="h-4 w-4 text-blue-500" />;
    case "PROPOSAL_MADE":
    case "PROPOSAL_ACCEPTED":
      return <HandCoins className="h-4 w-4 text-green-500" />;
    case "PROPOSAL_WITHDRAWN":
      return <X className="h-4 w-4 text-muted-foreground" />;
    case "ESCALATION_REQUESTED":
    case "ESCALATED":
    case "REJECTED_TO_ADMIN":
      return <Scale className="h-4 w-4 text-purple-500" />;
    case "RESOLVED":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    default:
      return <Info className="h-4 w-4 text-muted-foreground" />;
  }
}

function getEventTitle(
  event: DisputeData["events"][number],
  isSelf: boolean,
  actorName: string,
  t: ReturnType<typeof useTranslations>,
) {
  const name = actorName;
  switch (event.type) {
    case "OPENED":
      return isSelf ? t("timelineOpenedSelf") : t("timelineOpenedOther", { name });
    case "SELLER_RESPONDED":
      return isSelf ? t("timelineRespondedSelf") : t("timelineRespondedOther", { name });
    case "PROPOSAL_MADE":
      return isSelf
        ? t("timelineProposalMadeSelf", { amount: event.detail ?? "" })
        : t("timelineProposalMadeOther", { name, amount: event.detail ?? "" });
    case "PROPOSAL_ACCEPTED":
      return isSelf
        ? t("timelineProposalAcceptedSelf", { amount: event.detail ?? "" })
        : t("timelineProposalAcceptedOther", { name, amount: event.detail ?? "" });
    case "PROPOSAL_WITHDRAWN":
      return isSelf ? t("timelineProposalWithdrawnSelf") : t("timelineProposalWithdrawnOther", { name });
    case "ESCALATION_REQUESTED":
      return isSelf ? t("timelineEscalationRequestedSelf") : t("timelineEscalationRequestedOther", { name });
    case "ESCALATED":
      return t("timelineEscalated");
    case "REJECTED_TO_ADMIN":
      return t("timelineRejectedToAdmin");
    case "RESOLVED":
      return t("timelineResolved");
    default:
      return event.type;
  }
}

function getEventDescription(
  event: DisputeData["events"][number],
  dispute: DisputeData,
  t: ReturnType<typeof useTranslations>,
) {
  switch (event.type) {
    case "OPENED":
      return dispute.description;
    case "SELLER_RESPONDED":
      return dispute.sellerResponse ?? "";
    case "RESOLVED":
      return getResolutionText(dispute, t);
    case "ESCALATED":
    case "REJECTED_TO_ADMIN":
      return t("escalateBothAccepted");
    default:
      return "";
  }
}

function getEventEvidence(event: DisputeData["events"][number], dispute: DisputeData) {
  if (event.type === "OPENED") return dispute.evidenceUrls;
  if (event.type === "SELLER_RESPONDED") return dispute.sellerEvidenceUrls;
  return undefined;
}

function TimelineItem({
  icon, title, date, description, evidenceUrls,
}: {
  icon: React.ReactNode;
  title: string;
  date: string;
  description: string;
  evidenceUrls?: string[];
}) {
  return (
    <div className="flex items-start gap-3 pl-1">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {date && <span className="text-xs text-muted-foreground">{date}</span>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{description}</p>
        {evidenceUrls && evidenceUrls.length > 0 && (
          <div className="mt-2 flex gap-2 flex-wrap">
            {evidenceUrls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-muted">
                  <Image src={url} alt={`Evidence ${i + 1}`} fill className="object-cover" sizes="64px" />
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DisputeActions({ dispute, router }: { dispute: DisputeData; router: ReturnType<typeof useRouter> }) {
  const t = useTranslations("disputes");
  const [loading, setLoading] = useState(false);
  const [showResponse, setShowResponse] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [responseEvidence, setResponseEvidence] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showProposal, setShowProposal] = useState(false);
  const [proposalAmount, setProposalAmount] = useState("");

  async function handleAction(action: () => Promise<{ error?: string; success?: boolean }>, successMessage?: string) {
    setLoading(true);
    const result = await action();
    if (result?.error) {
      toast.error(result.error);
      setLoading(false);
      return;
    }
    toast.success(successMessage ?? t("disputeResolved"));
    router.refresh();
    setLoading(false);
  }

  // Current user ID for proposal checks
  const currentUserId = dispute.isBuyer ? dispute.bundle.buyerId : dispute.bundle.sellerId;
  const hasProposal = dispute.partialRefundAmount !== null && dispute.proposedById !== null;
  const proposalIsFromOther = hasProposal && dispute.proposedById !== currentUserId;
  const proposalIsFromSelf = hasProposal && dispute.proposedById === currentUserId;
  const proposerName = dispute.proposedById === dispute.bundle.buyerId
    ? dispute.bundle.buyerName
    : dispute.bundle.sellerName;

  // Escalation state
  const myEscalation = dispute.isBuyer ? dispute.buyerAcceptsEscalation : dispute.sellerAcceptsEscalation;
  const otherEscalation = dispute.isBuyer ? dispute.sellerAcceptsEscalation : dispute.buyerAcceptsEscalation;

  return (
    <div className="space-y-4">
      {/* Active proposal from the OTHER party → can accept */}
      {proposalIsFromOther && (
        <div className="glass rounded-xl p-4 border-l-4 border-l-green-400 dark:border-l-green-500">
          <div className="flex items-start gap-3">
            <HandCoins className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                {t("proposedBy", { name: proposerName })}
              </p>
              <p className="mt-1 text-lg font-bold text-foreground">
                &euro;{dispute.partialRefundAmount?.toFixed(2)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(dispute.isBuyer ? "acceptProposalHintBuyer" : "acceptProposalHintSeller", { amount: dispute.partialRefundAmount?.toFixed(2) ?? "0.00" })}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleAction(() => acceptMutualResolution(dispute.id), t("disputeResolved"))}
                  disabled={loading}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? "..." : t("acceptProposal")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active proposal from SELF → waiting for other party */}
      {proposalIsFromSelf && (
        <div className="glass rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                {t(dispute.isBuyer ? "proposalPendingSelfBuyer" : "proposalPendingSelfSeller", {
                  amount: dispute.partialRefundAmount?.toFixed(2) ?? "0.00",
                })}
              </p>
              <button
                onClick={() => handleAction(() => withdrawProposal(dispute.id), t("proposalWithdrawn"))}
                disabled={loading}
                className="mt-2 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50"
              >
                {t("withdrawProposal")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Seller: respond to OPEN dispute */}
      {dispute.isSeller && dispute.status === "OPEN" && (
        <div className="glass rounded-xl p-4 space-y-4">
          <p className="text-sm font-semibold text-foreground">{t("sellerResponseLabel")}</p>
          {!showResponse ? (
            <button
              onClick={() => setShowResponse(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
            >
              <MessageCircle className="h-4 w-4" />
              {t("submitResponse")}
            </button>
          ) : (
            <div className="space-y-3">
              <textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder={t("sellerResponsePlaceholder")}
                rows={4}
                className="block w-full glass-input px-3 py-2 text-sm text-foreground resize-none"
              />
              {/* Evidence upload */}
              <div>
                <p className="text-sm font-medium text-foreground mb-1">{t("sellerResponseEvidenceLabel")}</p>
                <p className="text-xs text-muted-foreground mb-2">{t("sellerResponseEvidenceHint")}</p>
                <EvidenceUploader images={responseEvidence} onChange={setResponseEvidence} uploading={uploading} setUploading={setUploading} />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAction(() => respondToDispute({ disputeId: dispute.id, sellerResponse: responseText, sellerEvidenceUrls: responseEvidence }), t("responseSubmitted"))}
                  disabled={loading || uploading || responseText.length < 20}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
                >
                  {loading ? "..." : t("submitResponse")}
                </button>
                <button
                  onClick={() => setShowResponse(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted/50"
                >
                  {t("cancelProposal")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Buyer: after seller responded — main actions */}
      {dispute.isBuyer && dispute.status === "SELLER_RESPONDED" && (
        <div className="glass rounded-xl p-4 space-y-4">
          {dispute.buyerReviewDeadline && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {t("buyerReviewDeadline", {
                date: new Date(dispute.buyerReviewDeadline).toLocaleDateString(
                  "nl-NL", { day: "numeric", month: "long", year: "numeric" }
                ),
              })}
            </p>
          )}

          <div className="space-y-3">
            {/* Accept seller response */}
            <div className="rounded-lg border border-border p-3">
              <button
                onClick={() => handleAction(() => acceptSellerResponse(dispute.id), t("disputeResolved"))}
                disabled={loading}
                className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {t("acceptResponse")}
              </button>
              <p className="mt-1.5 text-xs text-muted-foreground text-center">{t("acceptResponseHint")}</p>
            </div>

            {/* Request automatic resolution */}
            <div className="rounded-lg border border-border p-3">
              <button
                onClick={() => handleAction(() => rejectAndResolve(dispute.id), t("disputeEscalated"))}
                disabled={loading}
                className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400 dark:hover:bg-red-950 disabled:opacity-50"
              >
                {t("requestRefund")}
              </button>
              <p className="mt-1.5 text-xs text-muted-foreground text-center">{t("requestRefundHint")}</p>
            </div>
          </div>
        </div>
      )}

      {/* Propose settlement — available for both parties in OPEN/SELLER_RESPONDED, hidden if escalation started */}
      {(dispute.status === "OPEN" || dispute.status === "SELLER_RESPONDED") && !proposalIsFromSelf && !myEscalation && (
        <div className="glass rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <HandCoins className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">{t("proposePartialRefund")}</p>
          </div>
          <p className="text-xs text-muted-foreground">{t(dispute.isBuyer ? "proposePartialRefundHintBuyer" : "proposePartialRefundHintSeller")}</p>

          {!showProposal ? (
            <button
              onClick={() => setShowProposal(true)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
            >
              {t("proposePartialRefund")}
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">&euro;</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={dispute.bundle.totalItemCost}
                  value={proposalAmount}
                  onChange={(e) => setProposalAmount(e.target.value)}
                  placeholder="0.00"
                  className="glass-input w-32 pl-7 pr-3 py-2 text-sm text-foreground"
                />
              </div>
              <span className="text-xs text-muted-foreground">
                max &euro;{dispute.bundle.totalItemCost.toFixed(2)}
              </span>
              <button
                onClick={() => handleAction(() => proposeMutualResolution(dispute.id, parseFloat(proposalAmount)), t("proposalSubmitted"))}
                disabled={loading || !proposalAmount || parseFloat(proposalAmount) <= 0 || parseFloat(proposalAmount) > dispute.bundle.totalItemCost}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
              >
                {loading ? "..." : t("submitProposal")}
              </button>
              <button
                onClick={() => { setShowProposal(false); setProposalAmount(""); }}
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                {t("cancelProposal")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Escalation section — hidden if settlement proposal is pending */}
      {(dispute.status === "OPEN" || dispute.status === "SELLER_RESPONDED") && !hasProposal && (
        <div className="glass rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">{t("escalateTitle")}</p>
          </div>
          <p className="text-xs text-muted-foreground">{t("escalateDescription")}</p>

          {myEscalation ? (
            <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 dark:bg-purple-950/30 dark:border-purple-900">
              <p className="text-sm text-purple-700 dark:text-purple-400">
                {otherEscalation
                  ? t("escalateBothAccepted")
                  : t("escalateWaiting")}
              </p>
            </div>
          ) : (
            <button
              onClick={() => handleAction(() => requestEscalation(dispute.id), t("escalationRequested"))}
              disabled={loading}
              className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100 dark:border-purple-900 dark:bg-purple-950/50 dark:text-purple-400 dark:hover:bg-purple-950 disabled:opacity-50"
            >
              <Scale className="inline h-4 w-4 mr-1.5" />
              {t("escalateAccept")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EvidenceUploader({
  images,
  onChange,
  uploading,
  setUploading,
  maxImages = 5,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  uploading: boolean;
  setUploading: (v: boolean) => void;
  maxImages?: number;
}) {
  async function uploadFiles(files: FileList | File[]) {
    const fileArray = Array.from(files);
    const remaining = maxImages - images.length;
    if (remaining <= 0) return;
    const toUpload = fileArray.slice(0, remaining);
    setUploading(true);
    const formData = new FormData();
    toUpload.forEach((f) => formData.append("files", f));
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.urls?.length) onChange([...images, ...data.urls]);
    } catch { /* ignore */ } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {images.map((url, i) => (
            <div key={url} className="group relative h-16 w-16 overflow-hidden rounded-lg bg-muted">
              <Image src={url} alt={`Evidence ${i + 1}`} fill className="object-cover" sizes="64px" />
              <button
                type="button"
                onClick={() => onChange(images.filter((_, idx) => idx !== i))}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {images.length < maxImages && (
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(e) => e.target.files && uploadFiles(e.target.files)}
          />
          <Upload className="h-4 w-4" />
          {uploading ? "..." : `${images.length}/${maxImages}`}
        </label>
      )}
    </div>
  );
}
