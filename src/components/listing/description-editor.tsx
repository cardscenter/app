"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Pencil, Save, X } from "lucide-react";
import { updateListingDescription } from "@/actions/listing";

interface Props {
  listingId: string;
  initialDescription: string;
}

// Inline-edit voor de description-tekst van een listing. Alleen zichtbaar voor
// de owner en alleen functioneel op ACTIVE / PARTIALLY_SOLD listings (server
// dwingt dit ook af). Geen rich-text — plain-text textarea om HTML-injectie via
// dit pad te voorkomen; bestaande description die HTML bevat blijft staan.
export function DescriptionEditor({ listingId, initialDescription }: Props) {
  const t = useTranslations("listing");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialDescription);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateListingDescription(listingId, value);
      if (result.error) setError(result.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setValue(initialDescription); setEditing(true); }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
      >
        <Pencil className="h-3.5 w-3.5" />
        {t("actions.editDescription")}
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={6}
        maxLength={2000}
        className="w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground"
      />
      <p className="text-xs text-muted-foreground">{value.length}/2000</p>
      {error && (
        <div className="rounded-lg bg-red-50 p-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          <X className="h-4 w-4" />
          {t("actions.cancel")}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending || value.trim().length < 10}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white shadow-md transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {t("actions.saveDescription")}
        </button>
      </div>
    </div>
  );
}
