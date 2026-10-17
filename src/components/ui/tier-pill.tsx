import { Zap, Crown, Building2 } from "lucide-react";
import { getTierConfig } from "@/lib/subscription-tiers";

/**
 * Eén gedeelde tier-pill (Fase 45, design-pass ronde G in pastels). Vervangt
 * de losse inline PRO/UNLIMITED-pills in seller-info-block /
 * seller-reputation-card / admin-pagina's.
 *
 * - FREE → niets (geen pill voor het basisniveau).
 * - ADMIN → rendert als ENTERPRISE (ADMIN mapt in de tier-config op Enterprise).
 * - Geen hooks, geen "use client": bruikbaar in server- én client-componenten.
 */
const STYLES = {
  PRO: {
    label: "PRO",
    Icon: Zap,
    className: "bg-[var(--pastel-blue)] text-[var(--pastel-blue-ink)]",
  },
  UNLIMITED: {
    label: "UNLIMITED",
    Icon: Crown,
    className: "bg-[var(--pastel-yellow)] text-[var(--pastel-yellow-ink)]",
  },
  ENTERPRISE: {
    label: "ENTERPRISE",
    Icon: Building2,
    className: "bg-[var(--foreground)] text-white",
  },
} as const;

const SIZES = {
  sm: { pill: "px-2 py-0.5 text-[10px]", icon: "size-2.5" },
  md: { pill: "px-2.5 py-1 text-xs", icon: "size-3" },
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
    <span className={`cc-pill inline-flex items-center gap-1 font-bold leading-none ${style.className} ${sz.pill} ${className}`}>
      <Icon className={sz.icon} /> {style.label}
    </span>
  );
}
