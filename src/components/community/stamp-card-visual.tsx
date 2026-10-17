/** Vaste, licht wisselende hoeken zodat de stempels er met de hand gezet uitzien. */
const TILT = [-14, 10, -5, 13, -10, 4, -13, 8, -3, 12];

/**
 * Stempelkaart (design-pass): een rij ronde vakjes. Een verdiend vakje toont
 * de Cards Center-stempel, licht scheef; de nieuwste wordt erin "gestempeld"
 * (`.cc-stamp-in` in globals.css). Puur presentatie.
 */
export function StampCardVisual({ total, filled, className = "" }: { total: number; filled: number; className?: string }) {
  const n = Math.max(1, Math.min(total, 20));
  const f = Math.max(0, Math.min(filled, n));
  return (
    <div className={`grid gap-2 ${n > 10 ? "grid-cols-6 sm:grid-cols-8" : "grid-cols-5"} ${className}`} role="img" aria-label={`${f} / ${n}`}>
      {Array.from({ length: n }, (_, i) => {
        const on = i < f;
        if (on) {
          return (
            <span key={i} className="relative aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/sections/stempel.webp"
                alt=""
                className={`absolute inset-0 h-full w-full drop-shadow-[0_1px_2px_rgba(32,32,32,0.25)] ${i === f - 1 ? "cc-stamp-in" : ""}`}
                style={{ rotate: `${TILT[i % TILT.length]}deg` }}
              />
            </span>
          );
        }
        return (
          <span key={i} className="flex aspect-square items-center justify-center rounded-full border-2 border-dashed border-[var(--foreground)]/25 bg-white/60">
            <span className="text-xs font-semibold text-[var(--foreground)]/35">{i + 1}</span>
          </span>
        );
      })}
    </div>
  );
}
