"use client";

import { useTranslations } from "next-intl";
import { Gavel, Tag, ShoppingBag } from "lucide-react";

const CONFIG: Record<string, { icon: typeof Gavel; bg: string; text: string; key: string }> = {
  auction: { icon: Gavel, bg: "bg-blue-100 dark:bg-blue-950", text: "text-blue-700 dark:text-blue-400", key: "sourceAuction" },
  claimsale: { icon: Tag, bg: "bg-amber-100 dark:bg-amber-950", text: "text-amber-700 dark:text-amber-400", key: "sourceClaimsale" },
  listing: { icon: ShoppingBag, bg: "bg-emerald-100 dark:bg-emerald-950", text: "text-emerald-700 dark:text-emerald-400", key: "sourceListing" },
};

export function SourceTypeBadge({ type, namespace = "sales" }: { type: string; namespace?: string }) {
  const t = useTranslations(namespace);
  const config = CONFIG[type] ?? CONFIG.listing;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${config.bg} ${config.text}`}>
      <Icon className="h-2.5 w-2.5" />
      {t(config.key)}
    </span>
  );
}
