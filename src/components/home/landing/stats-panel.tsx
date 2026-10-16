"use client";

import { useMemo, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { RollingNumber } from "./rolling-number";
import { Balloon, type BalloonColor } from "./balloon";

export interface StatCardData {
  badge: string;
  color: "pink" | "green" | "yellow";
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
  feed: string;
  stats: { label: string; value: string }[];
  status: string;
}

const BG: Record<StatCardData["color"], string> = { pink: "var(--cc-pink)", green: "var(--cc-green)", yellow: "var(--cc-yellow)" };
const INK: Record<StatCardData["color"], string> = { pink: "var(--cc-pink-ink)", green: "var(--cc-green-ink)", yellow: "var(--cc-yellow-ink)" };

/** Deterministische, licht stijgende lijn (geen echte tijdreeks, puur sfeer). */
function sparkPath(seed: number, w = 148, h = 72) {
  const pts: number[] = [];
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const wobble = Math.sin(seed * 3.1 + i * 1.7) * 0.07;
    pts.push(0.35 + t * 0.55 + wobble);
  }
  const step = w / (pts.length - 1);
  const coords = pts.map((v, i) => ({ x: i * step, y: h - v * (h - 4) - 2 }));
  let d = `M${coords[0]!.x.toFixed(1)} ${coords[0]!.y.toFixed(1)}`;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1]!;
    const b = coords[i]!;
    const c = step * 0.4;
    d += `C${(a.x + c).toFixed(1)} ${a.y.toFixed(1)} ${(b.x - c).toFixed(1)} ${b.y.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }
  return { line: d, fill: `${d}L${w} ${h}L0 ${h}Z` };
}

function StatCard({ card, index }: { card: StatCardData; index: number }) {
  const path = useMemo(() => sparkPath(index + 1), [index]);
  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-[12px] bg-white p-6 shadow-[0_2px_8px_0_var(--cc-border-subtle)] max-lg:p-5">
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo-white-bg.png" alt="" className="h-5 w-auto" />
        <span className="cc-pill inline-flex h-7 items-center px-2.5 text-xs font-semibold" style={{ background: "var(--cc-ink)", color: BG[card.color] }}>
          {card.badge}
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="text-[64px] font-bold leading-[0.86] tracking-[-0.04em] text-[var(--cc-ink)] lg:text-7xl">
          <RollingNumber value={card.value} prefix={card.prefix} suffix={card.suffix} delay={300 + index * 350} />
        </p>
        <div className="relative h-[72px] w-[148px] shrink-0" aria-hidden>
          <svg viewBox="0 0 148 72" className="absolute inset-0 h-full w-full" fill="none">
            <path d={path.fill} fill={BG[card.color]} opacity="0.35" />
            <path d={path.line} stroke={INK[card.color]} strokeOpacity="0.7" strokeWidth="1.5" />
          </svg>
        </div>
      </div>
      <p className="mt-1 text-sm font-semibold text-[var(--cc-ink)]">{card.label}</p>
      <div className="mt-4 min-h-16 rounded-[6px] bg-[var(--cc-surface-2)] p-3">
        <p className="text-xs font-medium leading-[1.65] text-[var(--cc-ink)]/60">{card.feed}</p>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        {card.stats.map((s) => (
          <div key={s.label} className="min-w-0">
            <p className="truncate text-xs text-[var(--cc-ink)]/60">{s.label}</p>
            <p className="mt-1 text-2xl font-bold leading-tight text-[var(--cc-ink)]">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-auto flex items-center gap-3 pt-5">
        <span className="relative size-5 shrink-0" aria-hidden>
          <span className="cc-ring absolute inset-0 rounded-full" style={{ background: INK[card.color], opacity: 0.2 }} />
          <span className="cc-pulse absolute left-[7px] top-[7px] size-1.5 rounded-full" style={{ background: INK[card.color] }} />
        </span>
        <p className="text-sm font-semibold text-[var(--cc-ink)]">{card.status}</p>
      </div>
    </div>
  );
}

/**
 * Gekleurd paneel met drie cijferkaarten die over de onderrand hangen
 * (zoals het roze paneel in de referentie). Cijfers rollen in beeld; de
 * kaartenrij schuift licht omhoog tijdens het scrollen.
 */
export function StatsPanel({
  titleLine1,
  titleLine2,
  description,
  cards,
  color = "pink",
  balloon = "red",
}: {
  titleLine1: string;
  titleLine2: string;
  description: string;
  cards: StatCardData[];
  color?: "pink" | "yellow" | "blue" | "green";
  balloon?: BalloonColor;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [60, -10]);
  const bg = { pink: "var(--cc-pink)", yellow: "var(--cc-yellow)", blue: "var(--cc-blue)", green: "var(--cc-green)" }[color];

  return (
    <div className="px-0 pb-6 sm:px-5 lg:px-6">
      <div className="relative w-full rounded-[20px] px-5 pb-0 pt-14 sm:px-8 lg:px-10 lg:pt-[76px]" style={{ background: bg }}>
        <div className="relative mx-auto w-full max-w-6xl">
          <h2 className="cc-display text-[44px] text-[var(--cc-ink)] md:text-[64px] lg:text-7xl">
            <span className="block">{titleLine1}</span>
            <span className="block">
              <motion.span
                className="relative mr-3 inline-block h-[0.86em] w-[0.86em] align-middle"
                initial={{ width: 0, scale: 0, opacity: 0 }}
                whileInView={{ width: "0.86em", scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.1, ease: [0.34, 1.56, 0.64, 1] }}
                aria-hidden
              >
                <Balloon color={balloon} shape="cloud" className="absolute inset-[-22%] h-[144%] w-[144%]" />
              </motion.span>
              {titleLine2}
            </span>
          </h2>
          <div className="mb-10 mt-6 flex w-full justify-end lg:mb-14">
            <p className="cc-prose w-full max-w-[36rem] text-base">{description}</p>
          </div>
          <motion.div ref={ref} style={{ y }} className="relative top-6 z-[2] grid w-full gap-4 lg:top-12 lg:grid-cols-3">
            {cards.map((c, i) => (
              <StatCard key={c.badge} card={c} index={i} />
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
