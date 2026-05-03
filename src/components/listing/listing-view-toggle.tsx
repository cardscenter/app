"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";

export function ListingViewToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const view = sp.get("view") === "grid" ? "grid" : "list";

  function setView(next: "list" | "grid") {
    if (next === view) return;
    const params = new URLSearchParams(sp.toString());
    if (next === "list") params.delete("view");
    else params.set("view", "grid");
    // Page reset zodat je niet midden in een lege grid eindigt.
    params.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div
      className="inline-flex rounded-lg border border-border bg-card p-0.5"
      role="group"
      aria-label="Weergave kiezen"
    >
      <button
        type="button"
        onClick={() => setView("list")}
        disabled={isPending}
        aria-pressed={view === "list"}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
          view === "list"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted"
        }`}
      >
        <List className="size-3.5" />
        Lijst
      </button>
      <button
        type="button"
        onClick={() => setView("grid")}
        disabled={isPending}
        aria-pressed={view === "grid"}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
          view === "grid"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted"
        }`}
      >
        <LayoutGrid className="size-3.5" />
        Foto's
      </button>
    </div>
  );
}
