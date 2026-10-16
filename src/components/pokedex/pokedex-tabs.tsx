"use client";

import { useState, type ReactNode } from "react";
import { Layers, Info } from "lucide-react";

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
 * de content voor SEO in de DOM staat. Design-pass: pil-tabs.
 */
export function PokedexTabs({ cardsLabel, infoLabel, cardsContent, infoContent, defaultTab = "cards" }: Props) {
  const [tab, setTab] = useState<"cards" | "info">(defaultTab);

  const tabButton = (key: "cards" | "info", label: string, Icon: typeof Layers) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      aria-pressed={tab === key}
      className={`cc-pill inline-flex h-10 items-center gap-2 px-5 text-sm font-semibold transition-colors ${tab === key ? "bg-[var(--foreground)] text-white" : "bg-white text-[var(--foreground)]/75 hover:text-[var(--foreground)]"}`}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        {tabButton("cards", cardsLabel, Layers)}
        {tabButton("info", infoLabel, Info)}
      </div>
      <div className={tab === "cards" ? "" : "hidden"}>{cardsContent}</div>
      <div className={tab === "info" ? "" : "hidden"}>{infoContent}</div>
    </div>
  );
}
