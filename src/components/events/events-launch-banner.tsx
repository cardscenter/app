"use client";

import { useState, useEffect } from "react";
import { X, PartyPopper, Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";

const STORAGE_KEY = "events-launch-banner-dismissed";

/** Launch-banner voor de jonge kalender — dismissible, en de page rendert 'm
 *  alleen zolang er nog weinig live events zijn (drempel in page.tsx). */
export function EventsLaunchBanner() {
  // Standaard zichtbaar (SSR rendert mee — geen layout-pop-in voor nieuwe
  // bezoekers); alleen wie 'm wegklikte ziet heel kort een flash bij hydration.
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") setVisible(false);
    } catch {
      // localStorage niet beschikbaar — banner blijft staan
    }
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // localStorage niet beschikbaar — banner komt volgende keer terug
    }
  }

  if (!visible) return null;

  return (
    <div className="relative mt-5 flex flex-col gap-3 rounded-xl border border-indigo-300 bg-indigo-50 p-4 pr-10 dark:border-indigo-700/60 dark:bg-indigo-950/40 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
          <PartyPopper className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold text-foreground">Nieuw: de evenementenkalender</p>
          <p className="text-sm text-muted-foreground">
            Organiseer jij een beurs of evenement? Zet &apos;m er als eerste op en pak maximale zichtbaarheid.
          </p>
        </div>
      </div>
      <Link
        href="/evenementen/nieuw"
        className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 sm:self-auto"
      >
        <Plus className="h-4 w-4" /> Evenement toevoegen
      </Link>
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2.5 top-2.5 rounded-full p-1 text-muted-foreground transition hover:bg-indigo-100 hover:text-foreground dark:hover:bg-indigo-900/50"
        aria-label="Sluit melding"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
