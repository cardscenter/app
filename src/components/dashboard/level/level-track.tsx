"use client";

import { useEffect, useRef } from "react";
import { SELLER_LEVELS, getLevel, getLevelProgress } from "@/lib/seller-levels";

/**
 * Horizontale voortgangs-tijdlijn door alle 14 seller-levels (Fase 44).
 * Vervangt het oude platte grid: één track met gevulde lijn tot het huidige
 * level, auto-gecentreerd op de huidige node. Op mobiel horizontaal
 * scrollbaar met snap.
 */
export function LevelTrack({
  xp,
  youAreHereLabel,
}: {
  xp: number;
  youAreHereLabel: string;
}) {
  const currentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Centreer het huidige level in beeld; block "nearest" voorkomt dat de
    // hele pagina verticaal meescrollt.
    currentRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, []);

  const current = getLevel(xp);
  const currentIndex = SELLER_LEVELS.findIndex((l) => l.nameKey === current.nameKey);
  const intraProgress = getLevelProgress(xp) / 100;
  const segments = SELLER_LEVELS.length - 1;
  // Gevulde lijn: tot het huidige node-midden + het stuk richting het volgende.
  const fillPct =
    currentIndex >= segments
      ? 100
      : ((currentIndex + intraProgress) / segments) * 100;

  return (
    <div className="overflow-x-auto px-5 py-8">
      <div className="relative flex min-w-max snap-x">
        {/* Achtergrondlijn + fill — loopt van node-midden tot node-midden
            (halve node-breedte = 3rem inset aan beide kanten). */}
        <div className="absolute left-12 right-12 top-6 h-1 -translate-y-1/2 rounded-full bg-muted" aria-hidden />
        <div
          className="absolute left-12 top-6 h-1 -translate-y-1/2 rounded-full bg-primary transition-all duration-500"
          style={{ width: `calc((100% - 6rem) * ${fillPct / 100})` }}
          aria-hidden
        />

        {SELLER_LEVELS.map((level, i) => {
          const isCurrent = i === currentIndex;
          const isUnlocked = xp >= level.minXP;
          return (
            <div
              key={level.nameKey}
              ref={isCurrent ? currentRef : undefined}
              className="relative flex w-24 snap-center flex-col items-center"
            >
              {isCurrent && (
                <span className="absolute -top-6 whitespace-nowrap rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  {youAreHereLabel}
                </span>
              )}
              <div
                className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 text-xl transition-transform ${
                  isCurrent
                    ? `${level.bgColor} ${level.borderColor} scale-110 ring-4 ring-primary/25`
                    : isUnlocked
                      ? `${level.bgColor} ${level.borderColor}`
                      : "border-border bg-muted opacity-50 grayscale"
                }`}
              >
                {level.icon}
              </div>
              <p
                className={`mt-2 text-center text-xs font-medium ${
                  isCurrent ? level.color : isUnlocked ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {level.name}
              </p>
              <p className="text-[10px] tabular-nums text-muted-foreground">
                {level.minXP.toLocaleString("nl-NL")} XP
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
