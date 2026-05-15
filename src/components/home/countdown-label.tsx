"use client";

import { useEffect, useState } from "react";

function formatCountdown(endTime: Date | string): string {
  const end = typeof endTime === "string" ? new Date(endTime) : endTime;
  const diffMs = end.getTime() - Date.now();
  if (diffMs <= 0) return "Beëindigd";

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // > 1 dag: dagen + uren + minuten
  if (days > 0) return `${days}d ${hours}u ${minutes}m`;
  // > 1 uur: uren + minuten
  if (hours > 0) return `${hours}u ${minutes}m`;
  // < 1 uur: minuten + seconden
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  // < 1 minuut: seconden
  return `${seconds}s`;
}

interface CountdownLabelProps {
  endTime: Date | string;
}

/**
 * Live tickende countdown — toont seconden onder 1u, minuten boven 1u,
 * dagen+uren+minuten voor langere veilingen. Tikt elke seconde.
 *
 * Gebruikt `suppressHydrationWarning` om hydration-mismatch te vermijden
 * (server-tijd vs client-tijd kan met 1s verschillen op het render-moment).
 */
export function CountdownLabel({ endTime }: CountdownLabelProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return <span suppressHydrationWarning>{formatCountdown(endTime)}</span>;
}
