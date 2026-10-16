"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

export type PastelName = "pink" | "yellow" | "blue" | "green";
const COLOR: Record<PastelName, string> = { pink: "var(--pastel-pink)", yellow: "var(--pastel-yellow)", blue: "var(--pastel-blue)", green: "var(--pastel-green)" };

/**
 * Veegstreep achter een woord: een ruwe markeerstift-veeg (SVG met ongelijke
 * randen) die bij in-view van links naar rechts getrokken wordt. Optioneel
 * een illustratie (transparante PNG/WebP) schuin achter het woord, met het
 * onderste deel weggeknipt (zoals de basiliek van Hulst op de homepage).
 */
export function Highlight({ children, color = "green", illustration }: { children: ReactNode; color?: PastelName; illustration?: { src: string; alt?: string; clipBottom?: number } }) {
  return (
    <span className="relative isolate inline-block whitespace-nowrap">
      {illustration && (
        <motion.img
          src={illustration.src}
          alt={illustration.alt ?? ""}
          aria-hidden={!illustration.alt}
          draggable={false}
          className="pointer-events-none absolute bottom-[-1.85em] left-1/2 -z-20 h-[6.2em] w-auto max-w-none select-none drop-shadow-[0_18px_24px_rgba(13,27,63,0.28)]"
          style={{ x: "-46%", rotate: 6, clipPath: `inset(0 0 ${illustration.clipBottom ?? 37}% 0)` }}
          initial={{ opacity: 0, y: 24, scale: 0.92 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-10% 0px" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      )}
      <motion.svg
        aria-hidden
        viewBox="0 0 100 30"
        preserveAspectRatio="none"
        className="absolute -inset-x-[0.25em] -top-[0.14em] -bottom-[0.1em] -z-10 h-[1.2em] w-[calc(100%+0.5em)] origin-left"
        style={{ rotate: "-2deg" }}
        initial={{ scaleX: 0, opacity: 0.6 }}
        whileInView={{ scaleX: 1, opacity: 0.95 }}
        viewport={{ once: true, margin: "-10% 0px" }}
        transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      >
        <path d="M3 7 C 18 2, 42 5, 60 3 S 92 1, 99 5 L 100 23 C 84 28, 58 25, 38 27 S 8 29, 1 25 Z" fill={COLOR[color]} />
      </motion.svg>
      <span className="relative">{children}</span>
    </span>
  );
}

/** Vervangt `word` in `text` door een gemarkeerde versie (hoofdletterongevoelig). */
export function withHighlight(text: string, word: string | undefined, opts?: { color?: PastelName; illustration?: { src: string; alt?: string; clipBottom?: number } }): ReactNode {
  if (!word) return text;
  const idx = text.toLowerCase().indexOf(word.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <Highlight color={opts?.color} illustration={opts?.illustration}>
        {text.slice(idx, idx + word.length)}
      </Highlight>
      {text.slice(idx + word.length)}
    </>
  );
}
