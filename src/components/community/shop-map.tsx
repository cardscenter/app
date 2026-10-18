"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Bike, Bus, Car, Maximize2, X } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { CARD } from "@/components/ploy/tile-styles";
import { Pill, type PastelColor } from "@/components/ploy/pill";

export type ShopMapModeKey = "car" | "bike" | "bus";

export interface ShopMapMode {
  key: ShopMapModeKey;
  title: string;
  text: string;
  /** Kort feit als pil, bv. "8 min lopen, 550 m". */
  fact: string;
  /** Google Maps-route met travelmode. */
  mapsUrl: string;
}

export interface ShopMapImages {
  main: string;
  car: string;
  bike: string;
  bus: string;
}

interface ShopMapLabels {
  intro: ReactNode;
  hint: string;
  routeLabel: string;
  enlargeLabel: string;
  closeLabel: string;
  alt: string;
}

const ICONS: Record<ShopMapModeKey, typeof Car> = { car: Car, bike: Bike, bus: Bus };
const COLORS: Record<ShopMapModeKey, PastelColor> = { car: "yellow", bike: "pink", bus: "blue" };

/** Zoompunt per route (percentages van de tekening, uit de kaarten afgelezen). */
const FOCUS: Record<ShopMapModeKey | "main", { scale: number; origin: string }> = {
  main: { scale: 1, origin: "50% 50%" },
  car: { scale: 1.6, origin: "26% 36%" },
  bike: { scale: 2, origin: "31% 33%" },
  bus: { scale: 1.4, origin: "44% 0%" },
};

const SPRING = { duration: 0.8, ease: [0.34, 1.56, 0.64, 1] as const };
const FADE = { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const };

/**
 * Plattegrond van Hulst met de routes naar de winkel (info-pagina). Alle
 * varianten zijn dezelfde tekening met een groene route erbovenop, dus ze
 * liggen als lagen op elkaar en vloeien over. Hover (alleen muis) toont een
 * route alvast, klik zet hem vast, tweede klik laat los; de kaart zoomt zacht
 * in op het gebied van de route (niet bij prefers-reduced-motion). "Vergroot"
 * opent dezelfde stapel schermvullend met pillen om te wisselen.
 */
export function ShopMap({ modes, images, labels }: { modes: ShopMapMode[]; images: ShopMapImages; labels: ShopMapLabels }) {
  const reduced = useReducedMotion();
  const [pinned, setPinned] = useState<ShopMapModeKey | null>(null);
  const [hover, setHover] = useState<ShopMapModeKey | null>(null);
  const [enlarged, setEnlarged] = useState(false);
  const active: ShopMapModeKey | "main" = hover ?? pinned ?? "main";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-10">
      {/* Kaart: op mobiel bovenaan, op desktop rechts */}
      <div className="lg:order-2">
        <div className="relative">
          <MapStack images={images} active={active} zoom={!reduced} alt={labels.alt} />
          <button
            type="button"
            data-map-enlarge
            onClick={() => setEnlarged(true)}
            className="cc-pill absolute bottom-3 right-3 inline-flex h-10 items-center gap-2 bg-white px-4 text-sm font-semibold text-[var(--foreground)] shadow-[0_8px_30px_-12px_rgba(32,32,32,0.35)] transition-colors hover:bg-[var(--background)]"
          >
            <Maximize2 className="size-4" />
            {labels.enlargeLabel}
          </button>
        </div>
      </div>

      {/* Uitleg en vervoerstegels */}
      <div className="flex flex-col gap-4 lg:order-1">
        <div className="cc-prose text-base">{labels.intro}</div>
        <p className="text-sm text-[var(--foreground)]/55 lg:hidden">{labels.hint}</p>
        <div className="flex flex-col gap-3" role="group">
          {modes.map((m) => {
            const Icon = ICONS[m.key];
            const isActive = active === m.key;
            const isPinned = pinned === m.key;
            return (
              <div
                key={m.key}
                className={`${CARD} flex gap-4 p-4 transition-[box-shadow,transform] duration-200 sm:p-5 ${isActive ? "-translate-y-0.5 shadow-[0_18px_40px_-24px_rgba(32,32,32,0.35)]" : ""}`}
                onPointerEnter={(e) => e.pointerType === "mouse" && setHover(m.key)}
                onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}
              >
                <button
                  type="button"
                  data-map-mode={m.key}
                  aria-pressed={isPinned}
                  onClick={() => setPinned((cur) => (cur === m.key ? null : m.key))}
                  onFocus={(e) => e.currentTarget.matches(":focus-visible") && setHover(m.key)}
                  onBlur={() => setHover(null)}
                  className="flex size-12 shrink-0 items-center justify-center rounded-full text-[var(--foreground)] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]/35"
                  style={{ background: `var(--pastel-${COLORS[m.key]})` }}
                  aria-label={m.title}
                >
                  <Icon className="size-5" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPinned((cur) => (cur === m.key ? null : m.key))}
                      className="text-left text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)] focus-visible:outline-none"
                      tabIndex={-1}
                    >
                      {m.title}
                    </button>
                    <Pill tone="pastel" color={COLORS[m.key]}>
                      {m.fact}
                    </Pill>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--foreground)]/70">{m.text}</p>
                  <a href={m.mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--foreground)] underline underline-offset-4">
                    {labels.routeLabel}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {enlarged && (
        <Lightbox
          modes={modes}
          images={images}
          initial={pinned ?? hover}
          alt={labels.alt}
          closeLabel={labels.closeLabel}
          onClose={() => setEnlarged(false)}
        />
      )}
    </div>
  );
}

/** De gestapelde kaarten: hoofdkaart plus drie route-lagen die in- en uitvloeien. */
function MapStack({ images, active, zoom, alt, className = "" }: { images: ShopMapImages; active: ShopMapModeKey | "main"; zoom: boolean; alt: string; className?: string }) {
  const focus = zoom ? FOCUS[active] : FOCUS.main;
  const layers: ShopMapModeKey[] = ["car", "bike", "bus"];
  return (
    <div className={`relative aspect-[1961/2092] overflow-hidden rounded-[16px] bg-white ${className}`}>
      <motion.div
        className="absolute inset-0"
        animate={{ scale: focus.scale }}
        style={{ transformOrigin: focus.origin }}
        transition={SPRING}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images.main} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
        {layers.map((k) => (
          <motion.img
            key={k}
            src={images[k]}
            alt=""
            aria-hidden
            initial={false}
            animate={{ opacity: active === k ? 1 : 0 }}
            transition={FADE}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ))}
      </motion.div>
    </div>
  );
}

function Lightbox({ modes, images, initial, alt, closeLabel, onClose }: { modes: ShopMapMode[]; images: ShopMapImages; initial: ShopMapModeKey | null; alt: string; closeLabel: string; onClose: () => void }) {
  const [mode, setMode] = useState<ShopMapModeKey | null>(initial);
  useBodyScrollLock(true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-4 bg-black/85 p-4" role="dialog" aria-modal="true" aria-label={alt} onClick={onClose}>
      <button type="button" onClick={onClose} aria-label={closeLabel} className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full bg-white text-[var(--foreground)] hover:bg-[var(--background)]">
        <X className="size-5" />
      </button>
      <div className="w-full max-w-[min(92vw,calc((100dvh-9rem)*1961/2092))]" onClick={(e) => e.stopPropagation()}>
        <MapStack images={images} active={mode ?? "main"} zoom={false} alt={alt} />
      </div>
      <div className="flex flex-wrap justify-center gap-2" onClick={(e) => e.stopPropagation()}>
        {modes.map((m) => {
          const Icon = ICONS[m.key];
          const on = mode === m.key;
          return (
            <button
              key={m.key}
              type="button"
              aria-pressed={on}
              onClick={() => setMode((cur) => (cur === m.key ? null : m.key))}
              className={`cc-pill inline-flex h-10 items-center gap-2 px-4 text-sm font-semibold transition-colors ${on ? "bg-white text-[var(--foreground)]" : "bg-white/15 text-white hover:bg-white/25"}`}
            >
              <Icon className="size-4" />
              {m.title}
            </button>
          );
        })}
      </div>
    </div>,
    document.body
  );
}
