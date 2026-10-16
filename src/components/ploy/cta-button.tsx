"use client";

import { useRef, type ReactNode } from "react";
import { animate, stagger } from "framer-motion";
import { Link } from "@/i18n/navigation";

const WIGGLE_COLORS = ["#ffc4ce", "#fff26b", "#c9dcff", "#d4f58f"];

const BASE =
  "cc-pill relative inline-flex items-center justify-center gap-1.5 overflow-hidden px-6 py-4 text-sm font-semibold leading-none tracking-[-0.01em] no-underline will-change-transform select-none";
const VARIANTS = {
  red: "cc-grad text-white",
  dark: "bg-[var(--cc-ink)] text-white",
  light: "bg-white text-[var(--cc-ink)]",
  ghost: "bg-white/10 text-white ring-1 ring-inset ring-white/80 backdrop-blur-sm hover:bg-white/15",
} as const;

function pickColor(prev: string | null) {
  const pool = WIGGLE_COLORS.filter((c) => c !== prev);
  return pool[Math.floor(Math.random() * pool.length)] ?? WIGGLE_COLORS[0];
}

/**
 * Knop uit de design-pass: letters wiebelen bij hover (elk teken knijpt
 * samen, draait en veert terug, met een flits in een pastelkleur), de knop
 * zelf veert iets uit, en bij klik doet hij een squash-and-stretch.
 */
export function CtaButton({
  href,
  children,
  variant = "red",
  className = "",
  icon,
  onClick,
  type,
}: {
  href?: string;
  children: string;
  variant?: keyof typeof VARIANTS;
  className?: string;
  icon?: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const lastColor = useRef<string | null>(null);
  const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const wiggle = () => {
    const el = ref.current;
    if (!el || reduced()) return;
    const chars = Array.from(el.querySelectorAll<HTMLElement>("[data-char]"));
    const color = pickColor(lastColor.current);
    lastColor.current = color;
    const base = getComputedStyle(el).color;
    animate(
      chars,
      { scaleY: [1, 0.25, 1], rotate: [0, 20, 0], color: [base, color, base] },
      { duration: 0.7, delay: stagger(0.017), ease: ["easeIn", [0.34, 1.56, 0.64, 1]], times: [0, 0.2, 1] },
    );
    animate(el, { scaleX: 1.05, scaleY: 1.08 }, { type: "spring", stiffness: 420, damping: 14 });
  };
  const rest = () => {
    const el = ref.current;
    if (!el || reduced()) return;
    animate(el, { scaleX: 1, scaleY: 1 }, { duration: 0.4, ease: "easeOut" });
  };
  const press = () => {
    const el = ref.current;
    onClick?.();
    if (!el || reduced()) return;
    animate(el, { scaleX: [1, 1.12, 0.95, 1.04, 1], scaleY: [1, 1.15, 0.93, 1.05, 1] }, { duration: 0.65, times: [0, 0.23, 0.46, 0.69, 1], ease: "easeOut" });
  };

  const content = (
    <>
      <span aria-hidden className="relative z-[1] flex items-center">
        {Array.from(children).map((c, i) => (
          <span key={i} data-char className={`inline-block origin-bottom-left ${c === " " ? "w-[0.3em]" : ""}`}>
            {c === " " ? " " : c}
          </span>
        ))}
      </span>
      {icon ? <span className="relative z-[1] ml-1 inline-flex">{icon}</span> : null}
    </>
  );
  const cls = `${BASE} ${VARIANTS[variant]} ${className}`;
  const handlers = { onPointerEnter: wiggle, onFocus: wiggle, onPointerLeave: rest, onBlur: rest, onClick: press };

  if (href) {
    return (
      <Link ref={ref as React.Ref<HTMLAnchorElement>} href={href} aria-label={children} className={cls} {...handlers}>
        {content}
      </Link>
    );
  }
  return (
    <button ref={ref as React.Ref<HTMLButtonElement>} type={type ?? "button"} aria-label={children} className={cls} {...handlers}>
      {content}
    </button>
  );
}
