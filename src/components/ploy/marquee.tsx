"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Doorlopende band (logo-wall uit de referentie): tekstitems met een
 * bolletje ertussen, schuift oneindig naar links, vervaagt aan de randen.
 */
export function Marquee({ intro, items, duration = 40 }: { intro: string; items: string[]; duration?: number }) {
  const reduced = useReducedMotion();
  const list = [...items, ...items];
  return (
    <section className="flex flex-col items-center gap-8 px-4 py-14 sm:px-5 lg:px-6" aria-label={intro}>
      <p className="text-sm font-semibold text-[var(--cc-ink)]/55">{intro}</p>
      <div
        className="relative w-full max-w-7xl overflow-hidden"
        style={{ maskImage: "linear-gradient(to right, transparent 0, black 8%, black 92%, transparent 100%)", WebkitMaskImage: "linear-gradient(to right, transparent 0, black 8%, black 92%, transparent 100%)" }}
      >
        <motion.ul
          className="flex w-max items-center gap-x-10 whitespace-nowrap"
          animate={reduced ? undefined : { x: ["0%", "-50%"] }}
          transition={{ duration, ease: "linear", repeat: Infinity }}
        >
          {list.map((item, i) => (
            <li key={i} className="flex items-center gap-x-10 text-[20px] font-semibold tracking-[-0.015em] text-[var(--cc-ink)]/75 max-lg:text-[18px]" aria-hidden={i >= items.length}>
              <span>{item}</span>
              <span className="inline-block size-2 rounded-full bg-[var(--cc-red)]" aria-hidden />
            </li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
