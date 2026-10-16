"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { Link } from "@/i18n/navigation";
import { DisplayHeading } from "@/components/ploy/display-heading";
import { FloatingBalloon } from "@/components/ploy/balloon";

export interface ActivityItem {
  id: string;
  time: string;
  badge: string;
  color: "pink" | "green" | "yellow" | "blue";
  title: string;
  description: string;
  href: string;
}

const BADGE: Record<ActivityItem["color"], string> = { pink: "var(--cc-pink)", green: "var(--cc-green)", yellow: "var(--cc-yellow)", blue: "var(--cc-blue)" };
const VISIBLE = 3;
const INTERVAL = 1800;

function ActivityCard({ item }: { item: ActivityItem }) {
  return (
    <Link href={item.href} className="flex h-[136px] w-full flex-col justify-between rounded-[8px] bg-white p-5 no-underline transition-shadow hover:shadow-[0_12px_30px_-18px_rgba(32,32,32,0.5)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--cc-ink)]/45">{item.time}</p>
        <span className="cc-pill inline-flex items-center px-3 py-1.5 text-xs font-semibold text-[var(--cc-ink)]" style={{ background: BADGE[item.color] }}>
          {item.badge}
        </span>
      </div>
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold leading-snug tracking-[-0.03em] text-[var(--cc-ink)]">{item.title}</p>
        <p className="cc-prose truncate text-sm">{item.description}</p>
      </div>
    </Link>
  );
}

/**
 * Geel paneel: kop boven links, kop onder rechts, daartussen een lijst van
 * drie kaarten waar elke 1,8 s een nieuwe van onderen inschuift (de bovenste
 * schuift eruit). Start zodra de lijst in beeld komt.
 */
export function ActivityPanel({ titleTop, titleBottom, items, color = "yellow" }: { titleTop: string; titleBottom: string; items: ActivityItem[]; color?: "yellow" | "pink" | "blue" | "green" }) {
  const listRef = useRef<HTMLDivElement>(null);
  const inView = useInView(listRef, { amount: 0.15, once: true });
  const reduced = useReducedMotion();
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    if (!inView || reduced || items.length <= VISIBLE) return;
    const id = window.setInterval(() => setCursor((c) => c + 1), INTERVAL);
    return () => window.clearInterval(id);
  }, [inView, reduced, items.length]);

  const shown = items.length <= VISIBLE ? items : Array.from({ length: VISIBLE }, (_, i) => items[(cursor + i) % items.length]!);
  const bg = { yellow: "var(--cc-yellow)", pink: "var(--cc-pink)", blue: "var(--cc-blue)", green: "var(--cc-green)" }[color];

  return (
    <div className="px-0 pb-6 sm:px-5 lg:px-6">
      <div className="relative w-full overflow-hidden rounded-[20px] px-5 py-14 sm:px-8 lg:px-24 lg:py-40" style={{ background: bg }}>
        <div className="relative mx-auto w-full max-w-6xl">
          <DisplayHeading tag="h2" size={2} text={titleTop} className="relative z-[1] mb-4" />
          <div className="relative mb-4 flex flex-col items-center">
            <FloatingBalloon color="yellow" shape="flower" className="pointer-events-none absolute -top-24 left-1/2 w-[min(640px,100%)] -translate-x-1/2" />
            <div ref={listRef} className="relative z-[1] flex w-full max-w-[36rem] flex-col gap-1 overflow-hidden" style={{ height: VISIBLE * 136 + (VISIBLE - 1) * 4 }}>
              <AnimatePresence initial={false} mode="popLayout">
                {shown.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 140 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -140 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <ActivityCard item={item} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
          <DisplayHeading tag="h2" size={2} text={titleBottom} className="relative z-[6] text-right" />
        </div>
      </div>
    </div>
  );
}
