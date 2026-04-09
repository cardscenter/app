"use client";

import { ChangeIndicator } from "./change-indicator";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  comparison?: {
    change: number;
    direction: "up" | "down" | "flat";
    invert?: boolean;
  };
  subtitle?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  iconColor,
  iconBg,
  comparison,
  subtitle,
}: StatCardProps) {
  return (
    <div className="glass-subtle rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2 ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold text-foreground">{value}</p>
            {subtitle && (
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {comparison && (
          <ChangeIndicator
            change={comparison.change}
            direction={comparison.direction}
            invert={comparison.invert}
          />
        )}
      </div>
    </div>
  );
}
