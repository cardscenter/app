"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";

const SIZES = {
  1: "text-[56px] md:text-[80px] lg:text-[96px] xl:text-[144px]",
  2: "text-[44px] md:text-[64px] lg:text-[80px] xl:text-[96px]",
  3: "text-[40px] md:text-[46px] lg:text-[52px] xl:text-[64px]",
  4: "text-[32px] lg:text-[40px] xl:text-[44px]",
} as const;

type Tag = "h1" | "h2" | "h3" | "p";

/**
 * Grote uppercase kop (design-pass). Met `scrollFill` vult elk woord zich
 * van links met kleur terwijl de kop door het beeld scrolt; zonder is het
 * een gewone kop in de display-letter.
 */
export function DisplayHeading({
  text,
  size = 1,
  tag = "h2",
  scrollFill = false,
  className = "",
  id,
  style,
  children,
}: {
  text: string;
  /** Alternatieve inhoud (bv. met een veegstreep op één woord); `text` blijft de aria-tekst. */
  children?: ReactNode;
  size?: keyof typeof SIZES;
  tag?: Tag;
  scrollFill?: boolean;
  className?: string;
  id?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLHeadingElement & HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 88%", "end 45%"] });
  const Comp = tag;
  const cls = `cc-display ${SIZES[size]} ${className}`;
  // De ref zit op beide varianten: useScroll verwacht een gehydrateerd
  // element, ook als er niets mee gedaan wordt.
  if (!scrollFill) {
    return (
      <Comp id={id} ref={ref} className={cls} style={style} aria-label={children ? text : undefined}>
        {children ?? text}
      </Comp>
    );
  }
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <Comp id={id} ref={ref} className={cls} style={style} aria-label={text}>
      {words.map((w, i) => (
        <span key={`${w}-${i}`} aria-hidden>
          <Word word={w} index={i} total={words.length} progress={scrollYProgress} />
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </Comp>
  );
}

function Word({ word, index, total, progress }: { word: string; index: number; total: number; progress: MotionValue<number> }) {
  // Elk woord vult na het vorige (stagger), met een kleine overlap zodat de
  // beweging vloeiend blijft.
  const start = index / (total + 0.5);
  const end = (index + 1.5) / (total + 0.5);
  const p = useTransform(progress, [start, end], ["0%", "100%"], { clamp: true });
  return <motion.span className="cc-word" style={{ "--p": p } as CSSProperties}>{word}</motion.span>;
}
