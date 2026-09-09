import { Zap, Crown, Building2 } from "lucide-react";
import { getTierConfig } from "@/lib/subscription-tiers";

/**
 * Eén gedeelde tier-pill (Fase 45). Vervangt de losse inline PRO/UNLIMITED-
 * pills in seller-info-block / seller-reputation-card / admin-pagina's.
 *
 * - FREE → niets (geen pill voor het basisniveau).
 * - ADMIN → rendert als ENTERPRISE (ADMIN mapt in de tier-config op Enterprise).
 * - Geen hooks, geen "use client": bruikbaar in server- én client-componenten.
 */
const STYLES = {
  PRO: {
    label: "PRO",
    Icon: Zap,
    className: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  },
  UNLIMITED: {
    label: "UNLIMITED",
    Icon: Crown,
    className: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  },
  ENTERPRISE: {
    label: "ENTERPRISE",
    Icon: Building2,
    className: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
} as const;

const SIZES = {
  sm: { pill: "px-1.5 py-0.5 text-[10px]", icon: "h-2.5 w-2.5" },
  md: { pill: "px-2 py-0.5 text-xs", icon: "h-3 w-3" },
} as const;

export function TierPill({
  accountType,
  size = "sm",
  className = "",
}: {
  accountType: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const key = getTierConfig(accountType).key;
  if (key === "FREE") return null;
  const style = STYLES[key];
  const sz = SIZES[size];
  const Icon = style.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-bold ${style.className} ${sz.pill} ${className}`}
    >
      <Icon className={sz.icon} /> {style.label}
    </span>
  );
}
