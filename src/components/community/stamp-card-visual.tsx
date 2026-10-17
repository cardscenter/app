/**
 * Vaste "willekeur" per vakje: een kleine hash van seed + vaknummer. Zo staat
 * elke stempel net anders (hoek, verschuiving, grootte), maar springt hij niet
 * bij elke render en klopt server- en client-HTML met elkaar.
 */
function rand(seed: string, i: number, salt: number): number {
  let h = 2166136261 ^ salt;
  const s = `${seed}:${i}`;
  for (let k = 0; k < s.length; k++) {
    h ^= s.charCodeAt(k);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Hoe een echte stempel landt: elke hoek, iets uit het midden, net wat groter of kleiner. */
function stampLook(seed: string, i: number) {
  return {
    rotate: Math.round(rand(seed, i, 1) * 360),
    x: Math.round((rand(seed, i, 2) - 0.5) * 12),
    y: Math.round((rand(seed, i, 3) - 0.5) * 12),
    scale: 0.92 + rand(seed, i, 4) * 0.12,
  };
}

/**
 * Stempelkaart (design-pass): een rij ronde vakjes. Een verdiend vakje toont
 * de Cards Center-stempel, gezet zoals met de hand: in een willekeurige stand,
 * soms op z'n kop, net niet in het midden; het gestippelde vakje blijft er
 * vaag achter staan, alsof de stempel erop gedrukt is. De nieuwste wordt erin "gestempeld"
 * (`.cc-stamp-in` in globals.css). Geef `seed` (bv. de speler-id) mee zodat
 * elke speler een eigen patroon heeft. Puur presentatie.
 */
export function StampCardVisual({ total, filled, seed = "cards-center", className = "" }: { total: number; filled: number; seed?: string; className?: string }) {
  const n = Math.max(1, Math.min(total, 20));
  const f = Math.max(0, Math.min(filled, n));
  return (
    <div className={`grid gap-2 ${n > 10 ? "grid-cols-6 sm:grid-cols-8" : "grid-cols-5"} ${className}`} role="img" aria-label={`${f} / ${n}`}>
      {Array.from({ length: n }, (_, i) => {
        if (i < f) {
          const look = stampLook(seed, i);
          return (
            <span key={i} className="relative aspect-square rounded-full border-2 border-dashed border-[var(--foreground)]/15">
              <span
                className="absolute -inset-[2px]"
                style={{ rotate: `${look.rotate}deg`, translate: `${look.x}% ${look.y}%`, scale: look.scale.toFixed(3) }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/sections/stempel.webp"
                  alt=""
                  className={`h-full w-full drop-shadow-[0_1px_2px_rgba(32,32,32,0.25)] ${i === f - 1 ? "cc-stamp-in" : ""}`}
                />
              </span>
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
