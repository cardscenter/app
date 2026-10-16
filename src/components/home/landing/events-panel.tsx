"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { withHighlight } from "@/components/ploy/highlight";

export interface EventCardData {
  id: string;
  href: string;
  weekday: string;
  day: string;
  month: string;
  time: string;
  title: string;
  type: string;
  typeColor: string;
  price: string;
  meta: string;
}

/** Kaart kantelt licht mee met de muis (perspective 800px). */
function useTilt(maxX = 8, maxY = 12) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.style.transition = "transform .3s ease-out, box-shadow .3s ease-out";
    const move = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const ry = (px - 0.5) * 2 * maxY;
      const rx = -(py - 0.5) * 2 * maxX;
      el.style.transform = `perspective(800px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale3d(1.02,1.02,1.02)`;
      el.style.boxShadow = `0 ${(10 + rx).toFixed(0)}px ${(30 + Math.abs(ry)).toFixed(0)}px rgba(0,0,0,0.12)`;
    };
    const leave = () => {
      el.style.transform = "";
      el.style.boxShadow = "";
    };
    el.addEventListener("mousemove", move);
    el.addEventListener("mouseleave", leave);
    return () => {
      el.removeEventListener("mousemove", move);
      el.removeEventListener("mouseleave", leave);
    };
  }, [maxX, maxY]);
  return ref;
}

/** Witte of donkere tekst op de type-kleur, afhankelijk van de helderheid. */
function inkOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#fff";
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "var(--cc-ink)" : "#fff";
}

function EventCard({ e, cta }: { e: EventCardData; cta: string }) {
  const ref = useTilt();
  return (
    <Link href={e.href} className="block h-full snap-start no-underline">
      <div ref={ref} className="relative flex h-full w-[300px] flex-col overflow-hidden rounded-[10px] bg-white sm:w-[340px]">
        <div className="flex flex-col gap-5 bg-[var(--cc-blue-light)] p-6 pb-12 pl-12">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo-white-bg.png" alt="" className="h-5 w-auto" />
            <span className="cc-pill inline-flex h-6 items-center px-2.5 text-[11px] font-semibold" style={{ background: e.typeColor, color: inkOn(e.typeColor) }}>
              {e.type}
            </span>
          </div>
          <p className="text-[var(--cc-ink)]">
            <span className="block text-sm font-semibold uppercase tracking-[0.08em] text-[var(--cc-ink)]/55">{e.weekday}</span>
            <span className="cc-display block text-6xl">{e.day}</span>
            <span className="block text-lg font-semibold">
              {e.month} · {e.time}
            </span>
          </p>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-6 pl-12">
          <p className="text-2xl font-semibold leading-[1.2] tracking-[-0.04em] text-[var(--cc-ink)]">{e.title}</p>
          <p className="cc-prose text-sm">{e.meta}</p>
          <div className="mt-auto flex items-center justify-between pt-3">
            <span className="text-base font-bold text-[var(--cc-ink)]">{e.price}</span>
            <span className="text-sm font-semibold text-[var(--cc-red)]">{cta} →</span>
          </div>
        </div>
        <div className="absolute left-6 top-0 h-full w-px bg-[var(--cc-border-subtle)]" aria-hidden />
      </div>
    </Link>
  );
}

/**
 * Blauw paneel met een sleepbare/scrollbare rij event-kaarten die rechts uit
 * het paneel loopt. Pijltjes scrollen per kaart; snap-points houden de kaart
 * netjes op zijn plek.
 */
export function EventsPanel({
  titleParts,
  highlightWord,
  illustration,
  description,
  events,
  cardCta,
  emptyTitle,
  emptyText,
  allLabel,
}: {
  /** Regel 1 en regel 2 van de kop. */
  titleParts: [string, string];
  /** Woord in de kop dat een markeerstift-streek krijgt (bv. "Hulst"). */
  highlightWord?: string;
  /** Decoratieve illustratie (transparante PNG) schuin rechts achter de kop. */
  illustration?: { src: string; alt?: string };
  description: string;
  events: EventCardData[];
  cardCta: string;
  emptyTitle: string;
  emptyText: string;
  allLabel: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const update = () => {
    const el = scroller.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  };
  useEffect(() => {
    update();
    const el = scroller.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [events.length]);
  const go = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * 364, behavior: "smooth" });

  const btn = (disabled: boolean) =>
    `flex size-9 items-center justify-center rounded-full transition-[background,transform] duration-200 ${disabled ? "border border-[var(--cc-ink)]/12 text-[var(--cc-ink)] cursor-default" : "bg-[var(--cc-ink)] text-white hover:scale-105"}`;

  return (
    <div className="px-0 pb-6 sm:px-5 lg:px-6">
      <div className="relative w-full overflow-visible rounded-[20px] bg-[var(--cc-blue)] px-5 pb-14 pt-20 sm:px-8 lg:px-24 lg:pb-[76px] lg:pt-24">
        <div className="relative z-[1] mx-auto w-full max-w-6xl">
          <h2 className="cc-display mb-6 text-[44px] text-[var(--cc-ink)] md:text-[64px] lg:text-7xl">
            <span className="block">{withHighlight(titleParts[0], highlightWord, { illustration })}</span>
            <span className="block">{withHighlight(titleParts[1], highlightWord, { illustration })}</span>
          </h2>
          <div className="flex flex-row justify-start">
            <div className="w-full max-w-[30rem]">
              <p className="cc-prose text-base">{description}</p>
              <div className="flex items-center gap-3 py-6">
                <button type="button" aria-label="Vorige" onClick={() => go(-1)} disabled={edge.start} className={btn(edge.start)}>
                  <ArrowLeft className="size-4" />
                </button>
                <button type="button" aria-label="Volgende" onClick={() => go(1)} disabled={edge.end} className={btn(edge.end)}>
                  <ArrowRight className="size-4" />
                </button>
                <Link href="/evenementen" className="ml-2 text-sm font-semibold text-[var(--cc-ink)] underline underline-offset-4">
                  {allLabel}
                </Link>
              </div>
            </div>
          </div>
          {events.length === 0 ? (
            <div className="rounded-[10px] bg-white p-8">
              <p className="text-2xl font-semibold tracking-[-0.04em] text-[var(--cc-ink)]">{emptyTitle}</p>
              <p className="cc-prose mt-2 max-w-[36rem]">{emptyText}</p>
            </div>
          ) : (
            <div className="-mr-5 overflow-hidden rounded-r-[20px] sm:-mr-8 lg:-mr-24">
            <div ref={scroller} className="cc-noscroll relative flex cursor-grab snap-x snap-mandatory gap-6 overflow-x-auto bg-[var(--cc-blue)] pb-2 pr-5 sm:pr-8 lg:pr-24" style={{ scrollPaddingLeft: 0 }}>
              {events.map((e) => (
                <div key={e.id} className="shrink-0">
                  <EventCard e={e} cta={cardCta} />
                </div>
              ))}
            </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
