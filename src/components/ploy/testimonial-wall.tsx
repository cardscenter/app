"use client";

import { Fragment, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { PunchCard } from "./punch-card";
import { Pill, type PastelColor } from "./pill";
import { UserAvatar } from "@/components/ui/user-avatar";

export type TestimonialCardColor = "white" | PastelColor;

export interface TestimonialItem {
  id: string;
  /** Quote; `**zinsdeel**` wordt vetgedrukt. */
  quote: string;
  authorName: string;
  authorRole?: string | null;
  /** Bron-label zoals de aanroeper het vertaald heeft (Google, Discord, In de winkel). */
  sourceLabel: string;
  sourceUrl?: string | null;
  avatarUrl?: string | null;
  color: TestimonialCardColor;
}

const BG: Record<TestimonialCardColor, string> = {
  white: "#ffffff",
  pink: "var(--pastel-pink)",
  yellow: "var(--pastel-yellow)",
  blue: "var(--pastel-blue)",
  green: "var(--pastel-green)",
};
const PILL_COLOR: Record<TestimonialCardColor, PastelColor> = { white: "yellow", pink: "pink", yellow: "yellow", blue: "blue", green: "green" };

/** `**vet**` → <strong>; de rest blijft platte tekst. */
export function renderEmphasis(text: string): ReactNode {
  const parts = text.split(/\*\*/);
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i} className="font-semibold text-[var(--foreground)]">{p}</strong> : <Fragment key={i}>{p}</Fragment>));
}

/**
 * Ervaringen-muur (referentie "the ploy effect"): punch-cards in kolommen,
 * elk met een bron-pil, de quote met vetgedrukte zinsdelen en onderin
 * avatar + naam + rol. Kaarten komen één voor één in beeld.
 */
export function TestimonialWall({ items, columns = 3, className = "" }: { items: TestimonialItem[]; columns?: 2 | 3; className?: string }) {
  const cols = columns === 3 ? "sm:columns-2 lg:columns-3" : "sm:columns-2";
  return (
    <div className={`${cols} gap-4 ${className}`}>
      {items.map((it, i) => (
        <motion.div
          key={it.id}
          className="mb-4 break-inside-avoid"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5, delay: (i % columns) * 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          <PunchCard className="flex flex-col gap-5 p-6" style={{ background: BG[it.color] }} dot={it.color === "white" ? "var(--border)" : "rgba(32,32,32,0.18)"}>
            <div className="flex items-center justify-between gap-3">
              <Pill color={PILL_COLOR[it.color]}>{it.sourceLabel}</Pill>
              {it.sourceUrl && (
                <a href={it.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-[var(--foreground)]/45 transition-colors hover:text-[var(--foreground)]" aria-label={it.sourceLabel}>
                  <ExternalLink className="size-4" />
                </a>
              )}
            </div>
            <blockquote className="text-[17px] leading-[1.45] tracking-[-0.01em] text-[var(--foreground)]/75">{renderEmphasis(it.quote)}</blockquote>
            <figcaption className="mt-auto flex items-center gap-3">
              <UserAvatar src={it.avatarUrl ?? null} name={it.authorName} size="md" className="ring-2 ring-white" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--foreground)]">{it.authorName}</p>
                {it.authorRole && <p className="truncate text-xs text-[var(--foreground)]/55">{it.authorRole}</p>}
              </div>
            </figcaption>
          </PunchCard>
        </motion.div>
      ))}
    </div>
  );
}
