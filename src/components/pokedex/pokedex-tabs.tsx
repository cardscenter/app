"use client";

import { useState, type ReactNode } from "react";
import { Layers, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  cardsLabel: string;
  infoLabel: string;
  cardsContent: ReactNode;
  infoContent: ReactNode;
  /** Start op de info-tab als er (nog) geen kaarten zijn. */
  defaultTab?: "cards" | "info";
}

/**
 * Tab-switcher voor de Pokédex-detailpagina: "Kaarten" (grid zoals op een
 * set-detailpagina) en "Pokémon informatie". Beide tabs blijven gemount
 * (hidden via CSS) zodat sort-state en scroll-posities behouden blijven en
 * de content voor SEO in de DOM staat.
 */
export function PokedexTabs({
  cardsLabel,
  infoLabel,
  cardsContent,
  infoContent,
  defaultTab = "cards",
}: Props) {
  const [tab, setTab] = useState<"cards" | "info">(defaultTab);

  const tabButton = (key: "cards" | "info", label: string, Icon: typeof Layers) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={cn(
        "inline-flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-semibold transition-colors sm:text-base",
        tab === key
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );

  return (
    <div>
      <div className="mb-6 flex gap-6 border-b border-border">
        {tabButton("cards", cardsLabel, Layers)}
        {tabButton("info", infoLabel, Info)}
      </div>
      <div className={tab === "cards" ? "" : "hidden"}>{cardsContent}</div>
      <div className={tab === "info" ? "" : "hidden"}>{infoContent}</div>
    </div>
  );
}
