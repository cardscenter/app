"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Link } from "@/i18n/navigation";
import { DisplayHeading } from "@/components/ploy/display-heading";
import { Balloon } from "@/components/ploy/balloon";
import { BrailleIcon, type BrailleAnimation } from "@/components/ploy/braille-icon";

export interface PillarItem {
  title: string;
  text: string;
  href: string;
  linkLabel: string;
  color: "pink" | "yellow" | "blue" | "green";
  animation: BrailleAnimation;
}

const COLOR: Record<PillarItem["color"], string> = { pink: "var(--cc-pink)", yellow: "var(--cc-yellow)", blue: "var(--cc-blue)", green: "var(--cc-green)" };

/**
 * "Drie pijlers"-sectie: grote kop die zich vult bij scrollen, een ballon die
 * meebeweegt met de scroll, en een witte kaart met drie kolommen.
 */
export function Pillars({ title, description, items }: { title: string; description: string; items: PillarItem[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 220]);
  const rotate = useTransform(scrollYProgress, [0, 1], [-8, 16]);
  const scale = useTransform(scrollYProgress, [0, 1], [1.35, 0.8]);

  return (
    <div ref={ref} className="relative flex w-full flex-col items-center px-4 pb-32 pt-28 sm:px-5 lg:px-6 lg:pb-40 lg:pt-36">
      <motion.div className="pointer-events-none absolute left-[52%] top-0 z-[1] size-40 lg:size-64" style={{ y, rotate, scale }} aria-hidden>
        <Balloon color="green" shape="flower" className="h-full w-full" />
      </motion.div>
      <div className="relative z-[2] flex w-full max-w-6xl flex-col gap-12 lg:gap-14">
        <div className="flex flex-col items-center gap-6 text-center">
          <DisplayHeading tag="h2" size={2} text={title} scrollFill className="text-center" />
          <p className="cc-prose max-w-[28rem] text-base">{description}</p>
        </div>
        <div className="flex w-full flex-col gap-4 rounded-[12px] bg-white p-6 lg:flex-row lg:items-stretch lg:gap-6 lg:p-8">
          {items.map((it, i) => (
            <div key={it.title} className="flex flex-1 lg:contents">
              {i > 0 && <div className="hidden w-px shrink-0 self-stretch bg-[var(--cc-border)] lg:block" aria-hidden />}
              <Link href={it.href} className="group flex flex-1 flex-col items-start gap-10 no-underline lg:gap-20">
                <BrailleIcon animation={it.animation} color={COLOR[it.color]} />
                <div className="flex flex-col gap-3">
                  <h3 className="text-2xl font-semibold leading-tight tracking-[-0.04em] text-[var(--cc-ink)]">{it.title}</h3>
                  <p className="cc-prose text-base">{it.text}</p>
                  <span className="mt-1 text-sm font-semibold text-[var(--cc-red)] group-hover:underline">{it.linkLabel} →</span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
