"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Truck } from "lucide-react";
import { openShippingIssue } from "@/actions/shipping-issue";
import {
  SHIPPING_ISSUE_TYPES,
  SHIPPING_ISSUE_TYPE_LABELS,
  type ShippingIssueType,
} from "@/lib/shipping-issue/config";

export function OpenShippingIssueForm({
  bundleId,
  onCancel,
  perspective = "buyer",
}: {
  bundleId: string;
  onCancel: () => void;
  perspective?: "buyer" | "seller";
}) {
  const router = useRouter();
  const [type, setType] = useState<ShippingIssueType | "">("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  // Verkopers krijgen alleen WRONG_DELIVERY te zien
  const availableTypes = perspective === "seller" ? (["WRONG_DELIVERY"] as const) : SHIPPING_ISSUE_TYPES;

  async function submit() {
    if (!type || description.length < 20) return;
    setLoading(true);
    const result = await openShippingIssue({ bundleId, type, description });
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Trackingticket geopend — admin gaat onderzoeken");
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 space-y-3 dark:border-sky-900 dark:bg-sky-950/30">
      <div className="flex items-center gap-2">
        <Truck className="h-4 w-4 text-sky-700 dark:text-sky-300" />
        <p className="text-sm font-medium text-sky-900 dark:text-sky-200">Meld een trackingprobleem</p>
      </div>
      <p className="text-xs text-sky-800 dark:text-sky-300">
        Voor lichtere problemen waar een vol geschil disproportioneel is. Admin onderzoekt en kan goodwill-vergoeding toekennen (tot €50), het ticket sluiten, of het omzetten naar een geschil.
      </p>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Type probleem</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ShippingIssueType)}
          className="block w-full glass-input px-3 py-2 text-sm text-foreground"
        >
          <option value="">Selecteer een type</option>
          {availableTypes.map((t) => (
            <option key={t} value={t}>{SHIPPING_ISSUE_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Beschrijving (min 20 tekens)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="block w-full glass-input px-3 py-2 text-sm text-foreground resize-none"
          placeholder="Beschrijf wat tracking laat zien, wanneer het laatst is gescand, en wat je verwachtte."
        />
        <p className="mt-1 text-xs text-muted-foreground">{description.length}/20</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={loading || !type || description.length < 20}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
        >
          {loading ? "Bezig..." : "Meld trackingprobleem"}
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
        >
          Annuleer
        </button>
      </div>
    </div>
  );
}
