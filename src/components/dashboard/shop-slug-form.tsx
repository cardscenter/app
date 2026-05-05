"use client";

import { useState, useTransition } from "react";
import { Globe, Check, Loader2 } from "lucide-react";
import { updateShopSlug } from "@/actions/profile";

interface Props {
  currentSlug: string | null;
}

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;

export function ShopSlugForm({ currentSlug }: Props) {
  const [slug, setSlug] = useState(currentSlug ?? "");
  const [isPending, startTransition] = useTransition();
  const [savedSlug, setSavedSlug] = useState(currentSlug);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const normalized = slug.trim().toLowerCase();
  const isEmpty = normalized.length === 0;
  const looksValid = isEmpty || SLUG_REGEX.test(normalized);
  const isUnchanged = normalized === (savedSlug ?? "");

  const handleSubmit = () => {
    setError(null);
    setSavedFlash(false);
    startTransition(async () => {
      const result = await updateShopSlug(isEmpty ? null : normalized);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setSavedSlug(isEmpty ? null : normalized);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-stretch gap-2">
        <div className="flex flex-1 items-center rounded-lg border border-border bg-card focus-within:border-primary">
          <span className="select-none border-r border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            cards-center.nl/winkel/
          </span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="jouw-winkel-naam"
            maxLength={32}
            className="flex-1 bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            disabled={isPending}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || isUnchanged || !looksValid}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isEmpty && savedSlug !== null ? (
            "Verwijderen"
          ) : (
            "Opslaan"
          )}
        </button>
      </div>

      {!looksValid && !isEmpty && (
        <p className="text-xs text-rose-600 dark:text-rose-400">
          Alleen kleine letters, cijfers en koppelteken (3-32 tekens). Mag niet beginnen of eindigen met een koppelteken.
        </p>
      )}

      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
      )}

      {savedFlash && (
        <p className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <Check className="h-3 w-3" />
          Opgeslagen
        </p>
      )}

      {savedSlug && (
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Globe className="h-4 w-4" />
            <span>Je shop-URL is actief op</span>
          </div>
          <a
            href={`/winkel/${savedSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block font-medium text-primary hover:underline"
          >
            cards-center.nl/winkel/{savedSlug}
          </a>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Bij downgrade naar PRO of FREE blijft je slug bewaard maar de URL werkt pas weer als je upgradet.
      </p>
    </div>
  );
}
