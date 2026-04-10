"use client";

import { cn } from "@/lib/utils";
import { EmberIcon } from "@/components/customization/ember-icon";

interface EmberBalanceProps {
  balance: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function EmberBalance({ balance, size = "md", className }: EmberBalanceProps) {
  const sizes = {
    sm: { icon: "size-3.5", text: "text-xs" },
    md: { icon: "size-4", text: "text-sm" },
    lg: { icon: "size-5", text: "text-base" },
  };

  const s = sizes[size];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 font-medium",
        s.text,
        className
      )}
    >
      <EmberIcon className={s.icon} />
      <span>{balance.toLocaleString("nl-NL")}</span>
    </div>
  );
}
