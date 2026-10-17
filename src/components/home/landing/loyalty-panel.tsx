"use client";

import { useRef, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

/**
 * Ronde stempel die bij het in beeld komen op de kop wordt gedrukt: hij valt
 * groot en scheef naar binnen, landt met een tik (inktring + lichte deuk in de
 * schaal) en blijft daarna zacht heen en weer wiegen.
 */
function StampMark({ src }: { src: string }) {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <span className="relative mr-[0.14em] inline-block h-[0.86em] w-[1em] -rotate-[8deg] align-middle" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="absolute -left-[0.04em] top-[-0.22em] h-[1.3em] w-[1.3em] max-w-none" />
      </span>
    );
  }
  return (
    <motion.span
      className="relative mr-[0.14em] inline-block h-[0.86em] align-middle"
      initial={{ width: 0 }}
      whileInView={{ width: "1em" }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      aria-hidden
    >
      {/* Inktring die bij de landing uitdijt en vervaagt. */}
      <motion.span
        className="pointer-events-none absolute -left-[0.04em] top-[-0.22em] h-[1.3em] w-[1.3em] rounded-full border-[0.06em] border-[var(--primary)]"
        initial={{ scale: 0.8, opacity: 0 }}
        whileInView={{ scale: [0.8, 0.8, 1.45], opacity: [0, 0.55, 0] }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, delay: 0.55, times: [0, 0.05, 1], ease: "easeOut" }}
      />
      <motion.span
        className="absolute -left-[0.04em] top-[-0.22em] block h-[1.3em] w-[1.3em]"
        initial={{ scale: 2.4, rotate: -38, opacity: 0, y: "-30%" }}
        whileInView={{ scale: [2.4, 0.86, 1.06, 1], rotate: [-38, -6, -10, -8], opacity: [0, 1, 1, 1], y: ["-30%", "0%", "0%", "0%"] }}
        viewport={{ once: true }}
        transition={{ duration: 0.75, delay: 0.15, times: [0, 0.55, 0.78, 1], ease: ["easeIn", "easeOut", "easeInOut"] }}
      >
        <motion.span
          className="block h-full w-full"
          animate={{ rotate: [0, 4, 0, -3, 0] }}
          transition={{ duration: 5, delay: 1.2, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            className="h-full w-full max-w-none drop-shadow-[0_0.04em_0.06em_rgba(32,32,32,0.25)]"
          />
        </motion.span>
      </motion.span>
    </motion.span>
  );
}

/**
 * Roze paneel van de homepage over de stempelkaart en de spaarpunten. De kop
 * (titel met geanimeerde stempel) staat links, rechts de uitleg met een knop;
 * de kaarten (`children`) hangen over de onderrand en schuiven licht omhoog
 * tijdens het scrollen.
 */
export function LoyaltyPanel({
  titleLine1,
  titleLine2,
  description,
  stampSrc,
  action,
  children,
}: {
  titleLine1: string;
  titleLine2: string;
  description: string;
  /** Ronde stempel-afbeelding die in de kop wordt "gestempeld". */
  stampSrc: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [60, -10]);

  return (
    <div className="px-0 pb-6 sm:px-5 lg:px-6">
      <div className="relative w-full rounded-[20px] bg-[var(--cc-pink)] px-5 pb-0 pt-14 sm:px-8 lg:px-10 lg:pt-[76px]">
        <div className="relative mx-auto w-full max-w-6xl">
          <h2 className="cc-display text-[44px] text-[var(--cc-ink)] md:text-[64px] lg:text-7xl">
            <span className="block">{titleLine1}</span>
            <span className="block">
              <StampMark src={stampSrc} />
              {titleLine2}
            </span>
          </h2>
          <div className="mb-10 mt-6 flex w-full justify-end lg:mb-14">
            <div className="w-full max-w-[36rem]">
              <p className="cc-prose text-base">{description}</p>
              {action && <div className="mt-6">{action}</div>}
            </div>
          </div>
          <motion.div ref={ref} style={{ y }} className="relative top-6 z-[2] grid w-full gap-4 lg:top-12 lg:grid-cols-2">
            {children}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
