"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ChangeIndicatorProps {
  change: number;
  direction: "up" | "down" | "flat";
  invert?: boolean; // true = up is bad (e.g. commission paid)
}

export function ChangeIndicator({ change, direction, invert = false }: ChangeIndicatorProps) {
  if (direction === "flat") {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        0%
      </span>
    );
  }

  const isPositive = invert ? direction === "down" : direction === "up";

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
      }`}
    >
      {direction === "up" ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {change}%
    </span>
  );
}
