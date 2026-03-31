"use client";

import { useTranslations, useLocale } from "next-intl";
import { useState } from "react";
import { adminResolveDispute } from "@/actions/dispute";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import {
  Scale,
  ExternalLink,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

type AdminDispute = {
  id: string;
  reason: string;
  description: string;
  evidenceUrls: string[];
  sellerResponse: string | null;
  sellerEvidenceUrls: string[];
  createdAt: string;
  bundle: {
    id: string;
    totalCost: number;
    totalItemCost: number;
    shippingCost: number;
    trackingUrl: string | null;
    buyerName: string;
    sellerName: string;
    carrier: string | null;
    items: { cardName: string; condition: string; price: number }[];
  };
};

const REASON_KEYS: Record<string, string> = {
  NOT_RECEIVED: "reasonNotReceived",
  NOT_AS_DESCRIBED: "reasonNotAsDescribed",
  DAMAGED_IN_TRANSIT: "reasonDamagedInTransit",
};

export function AdminDisputesList({ disputes }: { disputes: AdminDispute[] }) {
  const t = useTranslations("disputes");

  if (disputes.length === 0) {
    return (
      <div className="mt-8 rounded-xl glass-subtle p-8 text-center">
        <Scale className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Geen geëscaleerde geschillen om te beoordelen.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {disputes.map((dispute) => (
        <AdminDisputeCard key={dispute.id} dispute={dispute} />
      ))}
    </div>
  );
}

function AdminDisputeCard({ dispute }: { dispute: AdminDispute }) {
  const t = useTranslations("disputes");
  const locale = useLocale();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [decision, setDecision] = useState<"BUYER" | "SELLER" | "PARTIAL" | "">("");
  const [partialAmount, setPartialAmount] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const formattedDate = new Date(dispute.createdAt).toLocaleDateString(
    locale === "nl" ? "nl-NL" : "en-GB",
    { day: "numeric", month: "long", year: "numeric" }
  );

  async function handleResolve() {
    if (!decision || !adminNotes) return;
    setLoading(true);

    const result = await adminResolveDispute({
      disputeId: dispute.id,
      decision: decision as "BUYER" | "SELLER" | "PARTIAL",
      partialAmount: decision === "PARTIAL" ? parseFloat(partialAmount) : undefined,
      adminNotes,
    });

    if (result?.error) {
      toast.error(result.error);
      setLoading(false);
      return;
    }

    toast.success(t("adminResolved"));
    router.refresh();
  }

  return (
    <div className="rounded-xl glass overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">
              {dispute.bundle.buyerName} vs {dispute.bundle.sellerName}
            </span>
            <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-950 dark:text-purple-400">
              {t("statusEscalated")}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            <span>{t(REASON_KEYS[dispute.reason])}</span>
            <span>&middot;</span>
            <span>{formattedDate}</span>
            <span>&middot;</span>
            <span>&euro;{dispute.bundle.totalCost.toFixed(2)}</span>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-border/50 p-4 space-y-4">
          {/* Buyer's complaint */}
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 dark:bg-amber-950/20 dark:border-amber-900">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
              Koper — {dispute.bundle.buyerName}
            </p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{dispute.description}</p>
          </div>

          {/* Seller's response */}
          {dispute.sellerResponse && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 dark:bg-blue-950/20 dark:border-blue-900">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">
                Verkoper — {dispute.bundle.sellerName}
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{dispute.sellerResponse}</p>
            </div>
          )}

          {/* Order details */}
          <div className="text-sm space-y-1">
            <p className="text-muted-foreground">
              Bestelling: &euro;{dispute.bundle.totalItemCost.toFixed(2)} + &euro;{dispute.bundle.shippingCost.toFixed(2)} verzending
            </p>
            {dispute.bundle.trackingUrl && (
              <a
                href={dispute.bundle.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Tracking link
              </a>
            )}
            {dispute.bundle.items.length > 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                {dispute.bundle.items.map((item, i) => (
                  <span key={i}>{item.cardName} ({item.condition}) — &euro;{item.price.toFixed(2)}{i < dispute.bundle.items.length - 1 ? ", " : ""}</span>
                ))}
              </div>
            )}
          </div>

          {/* Decision form */}
          <div className="border-t border-border/50 pt-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">{t("adminDecision")}</p>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                onClick={() => setDecision("BUYER")}
                className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                  decision === "BUYER"
                    ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <p className="font-medium">{t("adminResolveBuyer")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">&euro;{dispute.bundle.totalCost.toFixed(2)} terug</p>
              </button>
              <button
                onClick={() => setDecision("SELLER")}
                className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                  decision === "SELLER"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <p className="font-medium">{t("adminResolveSeller")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Escrow vrijgegeven</p>
              </button>
              <button
                onClick={() => setDecision("PARTIAL")}
                className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                  decision === "PARTIAL"
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <p className="font-medium">{t("adminResolvePartial")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Compromis</p>
              </button>
            </div>

            {decision === "PARTIAL" && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Bedrag:</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">&euro;</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={dispute.bundle.totalItemCost}
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    className="glass-input w-32 pl-7 pr-3 py-2 text-sm text-foreground"
                  />
                </div>
                <span className="text-xs text-muted-foreground">max &euro;{dispute.bundle.totalItemCost.toFixed(2)}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t("adminNotes")}</label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder={t("adminNotesPlaceholder")}
                rows={3}
                className="block w-full glass-input px-3 py-2 text-sm text-foreground resize-none"
              />
            </div>

            <button
              onClick={handleResolve}
              disabled={loading || !decision || !adminNotes || (decision === "PARTIAL" && (!partialAmount || parseFloat(partialAmount) <= 0))}
              className="rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? "..." : t("adminResolve")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
