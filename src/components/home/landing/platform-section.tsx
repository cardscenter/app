"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { DisplayHeading } from "./display-heading";
import { Balloon } from "./balloon";

export interface PlatformColumn {
  badge: string;
  color: "pink" | "green" | "yellow";
  title: string;
  bullets: string[];
}

const BADGE_TEXT: Record<PlatformColumn["color"], string> = { pink: "var(--cc-pink)", green: "var(--cc-green)", yellow: "var(--cc-yellow)" };

/**
 * "Eén account"-sectie: vier grote woorden die afwisselend links en rechts
 * staan en elk met een eigen snelheid meescrollen, met daarachter een
 * cluster ballonnen. Daaronder drie kolommen met wat het account allemaal
 * regelt.
 */
export function PlatformSection({ words, columns }: { words: [string, string, string, string]; columns: PlatformColumn[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], [80, -220]);
  const y1 = useTransform(scrollYProgress, [0, 1], [0, 110]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 170]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const word = "cc-display w-full text-[var(--cc-ink)] text-[96px] lg:text-[118px] xl:text-[144px]";

  return (
    <div ref={ref} className="flex justify-center px-4 pb-24 pt-20 sm:px-5 lg:px-6 lg:pb-40 lg:pt-36">
      <div className="w-full max-w-6xl">
        <div className="relative flex items-center justify-center">
          {/* Ballon-cluster */}
          <motion.div className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto h-[720px] w-full max-w-[900px] -translate-y-1/2" style={{ y: bgY }} aria-hidden>
            <Balloon color="blue" shape="cloud" className="absolute left-[8%] top-[4%] w-[44%]" />
            <Balloon color="yellow" shape="flower" className="absolute left-[46%] top-[0%] w-[30%]" />
            <Balloon color="green" shape="cloud" className="absolute left-[30%] top-[34%] w-[40%]" />
            <Balloon color="red" shape="stack" className="absolute left-[14%] top-[58%] w-[36%]" />
            <Balloon color="pink" shape="cloud" className="absolute left-[54%] top-[52%] w-[34%]" />
          </motion.div>
          {/* Desktop: vier parallax-woorden */}
          <div className="relative hidden h-[880px] w-full flex-col justify-between md:flex xl:h-[1060px]">
            <motion.p className={word} style={{ y: y1 }}>
              {words[0]}
            </motion.p>
            <motion.p className={`${word} text-right`} style={{ y: y2 }}>
              {words[1]}
            </motion.p>
            <motion.p className={word} style={{ y: y3 }}>
              {words[2]}
            </motion.p>
            <p className={`${word} text-right`}>{words[3]}</p>
          </div>
          {/* Mobiel: één kop */}
          <div className="relative flex min-h-[420px] items-end justify-center pb-6 md:hidden">
            <DisplayHeading tag="h2" size={2} text={words.join(" ")} className="text-center" />
          </div>
        </div>

        <div className="mt-10 flex w-full flex-col gap-6 rounded-[12px] bg-white p-6 lg:flex-row lg:gap-8 lg:p-8">
          {columns.map((c, i) => (
            <div key={c.badge} className="flex flex-1 lg:contents">
              {i > 0 && <div className="hidden w-px shrink-0 self-stretch bg-[var(--cc-border)] lg:block" aria-hidden />}
              <div className="flex flex-1 flex-col gap-10 lg:gap-24">
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/logo-white-bg.png" alt="" className="h-6 w-auto" />
                  <span className="cc-pill inline-flex h-7 items-center bg-[var(--cc-ink)] px-3 text-xs font-semibold" style={{ color: BADGE_TEXT[c.color] }}>
                    {c.badge}
                  </span>
                </div>
                <div className="flex flex-col gap-4">
                  <p className="text-2xl font-semibold leading-[1.3] tracking-[-0.04em] text-[var(--cc-ink)]">{c.title}</p>
                  <ul className="flex flex-col gap-3">
                    {c.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-4">
                        <span className="size-1.5 shrink-0 rounded-full" style={{ background: BADGE_TEXT[c.color], filter: "saturate(1.6) brightness(0.8)" }} aria-hidden />
                        <span className="cc-prose text-base">{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
