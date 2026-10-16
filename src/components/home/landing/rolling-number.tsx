"use client";

import { useEffect, useState } from "react";

/**
 * Cijferteller: elk cijfer is een kolom 0-9 die naar de juiste positie rolt
 * (zoals de stats-kaarten in de referentie). Start op 0 en rolt na `delay`
 * ms naar `value`. Prefix/suffix (bv. "€" of "+") rollen niet mee.
 */
export function RollingNumber({ value, delay = 300, prefix = "", suffix = "", className = "" }: { value: number; delay?: number; prefix?: string; suffix?: string; className?: string }) {
  const target = Math.max(0, Math.round(value));
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setShown(target), delay);
    return () => window.clearTimeout(t);
  }, [target, delay]);
  const digits = String(shown).padStart(String(target).length, "0").split("");
  return (
    <span className={`inline-flex items-baseline tabular-nums ${className}`} aria-label={`${prefix}${target}${suffix}`}>
      {prefix ? <span>{prefix}</span> : null}
      {digits.map((d, i) => (
        <span key={i} className="cc-digit" aria-hidden>
          <span className="cc-digit-inner" style={{ transform: `translateY(-${Number(d)}em)` }}>
            {Array.from({ length: 10 }, (_, n) => (
              <span key={n}>{n}</span>
            ))}
          </span>
        </span>
      ))}
      {suffix ? <span>{suffix}</span> : null}
    </span>
  );
}
