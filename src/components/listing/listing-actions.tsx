"use client";

import { useTranslations } from "next-intl";
import {
  updateListingStatus,
  pauseListing,
  resumeListing,
  publishDraft,
  deleteDraft,
  closePartiallySoldListing,
} from "@/actions/listing";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ListingStatus } from "@/types";

interface Props {
  listingId: string;
  status: ListingStatus;
}

export function ListingActions({ listingId, status }: Props) {
  const t = useTranslations("listing");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function run(fn: () => Promise<{ error?: string; success?: boolean } | undefined>, confirmKey?: string) {
    if (confirmKey && !confirm(t(confirmKey))) return;
    setLoading(true);
    const result = await fn();
    if (result?.error) alert(result.error);
    else router.refresh();
    setLoading(false);
  }

  const baseBtn =
    "w-full rounded-xl px-4 py-2.5 text-sm font-medium shadow-md transition-all disabled:opacity-50";

  if (status === "DRAFT") {
    return (
      <div className="space-y-2">
        <button
          onClick={() => run(() => publishDraft(listingId))}
          disabled={loading}
          className={`${baseBtn} bg-primary text-white hover:bg-primary-hover`}
        >
          {t("actions.publish")}
        </button>
        <button
          onClick={() => run(() => deleteDraft(listingId), "actions.confirmDeleteDraft")}
          disabled={loading}
          className={`${baseBtn} border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30`}
        >
          {t("actions.deleteDraft")}
        </button>
      </div>
    );
  }

  if (status === "PAUSED") {
    return (
      <div className="space-y-2">
        <button
          onClick={() => run(() => resumeListing(listingId))}
          disabled={loading}
          className={`${baseBtn} bg-emerald-600 text-white hover:bg-emerald-700`}
        >
          {t("actions.resume")}
        </button>
        <button
          onClick={() => run(() => updateListingStatus(listingId, "DELETED"), "actions.confirmDelete")}
          disabled={loading}
          className={`${baseBtn} border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30`}
        >
          {t("deleteListing")}
        </button>
      </div>
    );
  }

  if (status === "RESERVED") {
    // Geen acties — listing is gekoppeld aan een bundle-offer of partial-balance
    // proposal en wordt automatisch teruggezet via cron of completion.
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
        {t("actions.reservedHint")}
      </div>
    );
  }

  if (status === "PARTIALLY_SOLD") {
    return (
      <div className="space-y-2">
        <button
          onClick={() => run(() => closePartiallySoldListing(listingId), "actions.confirmCloseRest")}
          disabled={loading}
          className={`${baseBtn} bg-green-600 text-white hover:bg-green-700`}
        >
          {t("actions.closeRest")}
        </button>
        <button
          onClick={() => run(() => pauseListing(listingId), "actions.confirmPause")}
          disabled={loading}
          className={`${baseBtn} border border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30`}
        >
          {t("actions.pause")}
        </button>
        <button
          onClick={() => run(() => updateListingStatus(listingId, "DELETED"), "actions.confirmDelete")}
          disabled={loading}
          className={`${baseBtn} border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30`}
        >
          {t("deleteListing")}
        </button>
      </div>
    );
  }

  if (status !== "ACTIVE") return null;

  // Fase 27.40: "Markeer als verkocht" verwijderd. Alle echte verkoop-flows
  // zetten SOLD automatisch (Direct Kopen, proposals, bundle-offers,
  // pickup-confirm). Handmatige flip zou cascade-rejection van pendings
  // missen + seller-stats vervuilen zonder echte transactie. Voor "weghalen
  // omdat ik 'm offline verkocht" → gebruik Verwijderen (zelfde resultaat).
  return (
    <div className="space-y-2">
      <button
        onClick={() => run(() => pauseListing(listingId), "actions.confirmPause")}
        disabled={loading}
        className={`${baseBtn} border border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30`}
      >
        {t("actions.pause")}
      </button>
      <button
        onClick={() => run(() => updateListingStatus(listingId, "DELETED"), "actions.confirmDelete")}
        disabled={loading}
        className={`${baseBtn} border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30`}
      >
        {t("deleteListing")}
      </button>
    </div>
  );
}
