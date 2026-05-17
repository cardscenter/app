"use client";

import { useState, useEffect } from "react";

export function MiniCountdown({ endTime, urgent }: { endTime: Date; urgent?: boolean }) {
  const [parts, setParts] = useState<{ d: number; h: number; m: number; s: number; over: boolean }>({
    d: 0, h: 0, m: 0, s: 0, over: false,
  });

  useEffect(() => {
    function update() {
      const diff = endTime.getTime() - Date.now();
      if (diff <= 0) {
        setParts({ d: 0, h: 0, m: 0, s: 0, over: true });
        return;
      }
      setParts({
        d: Math.floor(diff / 86_400_000),
        h: Math.floor((diff % 86_400_000) / 3_600_000),
        m: Math.floor((diff % 3_600_000) / 60_000),
        s: Math.floor((diff % 60_000) / 1000),
        over: false,
      });
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  if (parts.over) {
    return <span className="font-mono">Afgelopen</span>;
  }

  // <24u: secondes tonen voor het live-effect. ≥24u: alleen d/u/m want
  // tikkende seconden over meerdere dagen geeft te veel visuele ruis.
  const showSeconds = parts.d === 0;
  const isUrgent = urgent || (parts.d === 0 && parts.h < 1);

  return (
    <span className={`font-mono tabular-nums ${isUrgent ? "text-rose-600 dark:text-rose-400" : ""}`}>
      {parts.d > 0 && <>{parts.d}d </>}
      {String(parts.h).padStart(2, "0")}u {String(parts.m).padStart(2, "0")}m
      {showSeconds && <> {String(parts.s).padStart(2, "0")}s</>}
    </span>
  );
}
