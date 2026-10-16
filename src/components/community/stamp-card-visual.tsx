import { Stamp } from "lucide-react";

/**
 * Stempelkaart (design-pass): een rij ronde vakjes, gevulde stempels in
 * inkt met een stempel-icoon in de accentkleur. Puur presentatie.
 */
export function StampCardVisual({ total, filled, accent = "var(--pastel-yellow)", className = "" }: { total: number; filled: number; accent?: string; className?: string }) {
  const n = Math.max(1, Math.min(total, 20));
  const f = Math.max(0, Math.min(filled, n));
  return (
    <div className={`grid gap-2 ${n > 10 ? "grid-cols-6 sm:grid-cols-8" : "grid-cols-5"} ${className}`} role="img" aria-label={`${f} / ${n}`}>
      {Array.from({ length: n }, (_, i) => {
        const on = i < f;
        return (
          <span
            key={i}
            className={`flex aspect-square items-center justify-center rounded-full border-2 border-dashed transition-colors ${on ? "border-transparent bg-[var(--foreground)]" : "border-[var(--foreground)]/25 bg-white/60"}`}
          >
            {on ? <Stamp className="size-[45%]" style={{ color: accent }} /> : <span className="text-xs font-semibold text-[var(--foreground)]/35">{i + 1}</span>}
          </span>
        );
      })}
    </div>
  );
}
