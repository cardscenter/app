"use client";

import { useEffect, useRef, useState } from "react";

/* Braille-animaties: een 4x8 raster van punten dat per frame een ander patroon
   toont (helix, regen, golven, scan, puls). Pure tekst in een mono-letter. */
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
function scan(): string[] {
  const frames: string[] = [];
  for (let s = -1; s < 9; s++) {
    const g = empty(4, 8);
    for (let r = 0; r < 4; r++) for (let x = 0; x < 8; x++) if (x === s || x === s - 1) g[r]![x] = true;
    frames.push(cell(g));
  }
  return frames;
}
function pulse(): string[] {
  const frames: string[] = [];
  for (const radius of [0.5, 1.2, 2, 3, 3.5]) {
    const g = empty(4, 6);
    for (let r = 0; r < 4; r++)
      for (let x = 0; x < 6; x++) {
        const d = Math.sqrt((x - 2.5) ** 2 + (r - 1.5) ** 2);
        if (Math.abs(d - radius) < 0.9) g[r]![x] = true;
      }
    frames.push(cell(g));
  }
  return frames;
}
const ANIMS = {
  helix: { frames: helix(), interval: 80 },
  rain: { frames: rain(), interval: 100 },
  waves: { frames: waves(), interval: 90 },
  scan: { frames: scan(), interval: 70 },
  pulse: { frames: pulse(), interval: 180 },
};
export type BrailleAnimation = keyof typeof ANIMS;

/** Zwart blokje met een bewegend braille-patroon in een accentkleur. */
export function BrailleIcon({ animation = "scan", color = "var(--pastel-yellow)", className = "" }: { animation?: BrailleAnimation; color?: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState(0);
  // Zonder IntersectionObserver (oude browsers) gewoon altijd tikken.
  const [visible, setVisible] = useState(() => typeof window !== "undefined" && typeof IntersectionObserver === "undefined");
  // Alleen tikken zolang het icoon in beeld is: elke frame is een React-render,
  // en op telefoons stapelden die zich op tijdens het scrollen (mobiel-fix 2026-10-17).
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setVisible(!!entry?.isIntersecting), { rootMargin: "80px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    const a = ANIMS[animation];
    const id = window.setInterval(() => setFrame((f) => (f + 1) % a.frames.length), a.interval);
    return () => window.clearInterval(id);
  }, [animation, visible]);
  return (
    <div ref={ref} className={`flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-[var(--foreground)] font-mono text-sm leading-none ${className}`} style={{ color }} aria-hidden>
      {ANIMS[animation].frames[frame]}
    </div>
  );
}
