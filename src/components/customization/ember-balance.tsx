"use client";

import { cn } from "@/lib/utils";
import { EmberIcon } from "@/components/customization/ember-icon";

interface EmberBalanceProps {
  balance: number;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function EmberBalance({ balance, size = "md", className }: EmberBalanceProps) {
  const sizes = {
    sm: { icon: "size-3.5", text: "text-xs" },
    md: { icon: "size-4", text: "text-sm" },
    lg: { icon: "size-5", text: "text-base" },
    xl: { icon: "size-8", text: "text-2xl" },
  };

  const s = sizes[size];

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center gap-1.5 font-medium",
        s.text,
        className
      )}
    >
      <EmberIcon className={cn(s.icon, "shrink-0")} />
      <span className="leading-none">{balance.toLocaleString("nl-NL")}</span>
    </div>
  );
}
