"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Link } from "@/i18n/navigation";
import { DisplayHeading } from "@/components/ploy/display-heading";
import { Balloon } from "@/components/ploy/balloon";

/* Braille-animaties: een 4x8 raster van punten dat per frame een ander patroon
   toont (helix, regen, golven). Pure tekst in een mono-letter, zoals de
   feature-kaarten in de referentie. */
const BITS = [
  [1, 8],
  [2, 16],
  [4, 32],
  [64, 128],
];
function cell(grid: boolean[][]): string {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  let out = "";
  for (let c = 0; c < Math.ceil(cols / 2); c++) {
    let code = 0x2800;
    for (let r = 0; r < 4 && r < rows; r++)
      for (let k = 0; k < 2; k++) {
        const col = c * 2 + k;
        if (col < cols && grid[r]?.[col]) code |= BITS[r]![k]!;
      }
    out += String.fromCodePoint(code);
  }
  return out;
}
const empty = (r: number, c: number) => Array.from({ length: r }, () => Array<boolean>(c).fill(false));
function helix(): string[] {
  const frames: string[] = [];
  for (let n = 0; n < 16; n++) {
    const g = empty(4, 8);
    for (let x = 0; x < 8; x++) {
      const a = (n + x) * (Math.PI / 4);
      g[Math.round(((Math.sin(a) + 1) / 2) * 3)]![x] = true;
      g[Math.round(((Math.sin(a + Math.PI) + 1) / 2) * 3)]![x] = true;
    }
    frames.push(cell(g));
  }
  return frames;
}
function rain(): string[] {
  const frames: string[] = [];
  const off = [0, 3, 1, 5, 2, 7, 4, 6];
  for (let n = 0; n < 12; n++) {
    const g = empty(4, 8);
    for (let x = 0; x < 8; x++) {
      const r = (n + off[x]!) % 6;
      if (r < 4) g[r]![x] = true;
    }
    frames.push(cell(g));
  }
  return frames;
}
function waves(): string[] {
  const frames: string[] = [];
  for (let n = 0; n < 16; n++) {
    const g = empty(4, 8);
    for (let x = 0; x < 8; x++) {
      const r = Math.round(((Math.sin((n - x * 0.5) * 0.8) + 1) / 2) * 3);
      g[r]![x] = true;
      if (r > 0) g[r - 1]![x] = (n + x) % 3 === 0;
    }
    frames.push(cell(g));
  }
  return frames;
}
const ANIMS = { helix: { frames: helix(), interval: 80 }, rain: { frames: rain(), interval: 100 }, waves: { frames: waves(), interval: 90 } };

export interface PillarItem {
  title: string;
  text: string;
  href: string;
  linkLabel: string;
  color: "pink" | "yellow" | "blue" | "green";
  animation: keyof typeof ANIMS;
}

const COLOR: Record<PillarItem["color"], string> = { pink: "var(--cc-pink)", yellow: "var(--cc-yellow)", blue: "var(--cc-blue)", green: "var(--cc-green)" };

function BrailleIcon({ animation, color }: { animation: keyof typeof ANIMS; color: string }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const a = ANIMS[animation];
    const id = window.setInterval(() => setFrame((f) => (f + 1) % a.frames.length), a.interval);
    return () => window.clearInterval(id);
  }, [animation]);
  return (
    <div className="flex size-9 items-center justify-center overflow-hidden rounded-[8px] bg-[var(--cc-ink)] font-mono text-sm leading-none" style={{ color }} aria-hidden>
      {ANIMS[animation].frames[frame]}
    </div>
  );
}

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
