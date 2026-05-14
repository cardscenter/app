"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Megaphone, Plus, Clock, X } from "lucide-react";
import {
  extendClaimsaleUpsell,
  addClaimsaleUpsell,
  cancelClaimsaleUpsell,
} from "@/actions/claimsale-promotion";
import { CLAIMSALE_UPSELL_TYPES_OFFERED } from "@/lib/upsell-config";

interface ActiveUpsell {
  id: string;
  type: string;
  startsAt: string;
  expiresAt: string;
  totalCost: number;
}

interface Props {
  claimsaleId: string;
  upsells: ActiveUpsell[];
}

const TYPE_LABELS: Record<string, string> = {
  HOMEPAGE_SPOTLIGHT: "Homepage Spotlight",
  CATEGORY_HIGHLIGHT: "Categorie-uitlichting",
  ITEM_PREVIEW: "Kaart-preview-rij",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ClaimsalePromotionManager({ claimsaleId, upsells }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const now = Date.now();
  const active = upsells.filter((u) => new Date(u.expiresAt).getTime() > now);
  const activeTypes = new Set(active.map((u) => u.type));
  const addableTypes = CLAIMSALE_UPSELL_TYPES_OFFERED.filter((t) => !activeTypes.has(t));

  const run = (fn: () => Promise<{ error?: string; refundedAmount?: number } | void>, okMsg: string) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      const refunded = result && "refundedAmount" in result ? result.refundedAmount ?? 0 : 0;
      if (refunded > 0) {
        toast.success(okMsg, {
          description: `€${refunded.toFixed(2).replace(".", ",")} teruggestort op je saldo.`,
          duration: 6000,
        });
      } else {
        toast.success(okMsg);
      }
      router.refresh();
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-amber-600" />
        <h3 className="text-sm font-semibold">Promotie beheren</h3>
      </div>

      {active.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Geen actieve promotie op deze claimsale.
        </p>
      )}

      {active.map((u) => (
        <ActiveUpsellRow
          key={u.id}
          upsell={u}
          pending={pending}
          onExtend={(days) =>
            run(() => extendClaimsaleUpsell(u.id, days), "Promotie verlengd")
          }
          onCancel={() =>
            run(() => cancelClaimsaleUpsell(u.id), "Promotie gestopt")
          }
        />
      ))}

      {addableTypes.length > 0 && (
        <div className="border-t border-border pt-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Promotie toevoegen</p>
          {addableTypes.map((t) => (
            <AddUpsellRow
              key={t}
              type={t}
              pending={pending}
              onAdd={(days) =>
                run(() => addClaimsaleUpsell(claimsaleId, t, days), "Promotie toegevoegd")
              }
            />
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function ActiveUpsellRow({
  upsell,
  pending,
  onExtend,
  onCancel,
}: {
  upsell: ActiveUpsell;
  pending: boolean;
  onExtend: (days: number) => void;
  onCancel: () => void;
}) {
  const [extraDays, setExtraDays] = useState(7);

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{TYPE_LABELS[upsell.type] ?? upsell.type}</span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          tot {formatDate(upsell.expiresAt)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={30}
          value={extraDays}
          onChange={(e) => setExtraDays(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
          className="w-16 rounded-md border border-border bg-background px-2 py-1 text-xs"
          disabled={pending}
        />
        <button
          type="button"
          onClick={() => onExtend(extraDays)}
          disabled={pending}
          className="flex-1 rounded-md border border-border px-2 py-1 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
        >
          + {extraDays} dagen verlengen
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          title="Promotie stoppen (pro-rata terugbetaling)"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-red-300 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function AddUpsellRow({
  type,
  pending,
  onAdd,
}: {
  type: string;
  pending: boolean;
  onAdd: (days: number) => void;
}) {
  const [days, setDays] = useState(7);

  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-xs">{TYPE_LABELS[type] ?? type}</span>
      <input
        type="number"
        min={1}
        max={30}
        value={days}
        onChange={(e) => setDays(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
        className="w-16 rounded-md border border-border bg-background px-2 py-1 text-xs"
        disabled={pending}
      />
      <button
        type="button"
        onClick={() => onAdd(days)}
        disabled={pending}
        className="flex items-center gap-1 rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30"
      >
        <Plus className="h-3 w-3" />
        Toevoegen
      </button>
    </div>
  );
}
