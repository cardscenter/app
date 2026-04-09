"use client";

import { motion } from "framer-motion";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import type { HomepageStats } from "@/lib/homepage-data";

interface HeroStatBadgesProps {
  stats: HomepageStats;
}

const badgeVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: 0.3 + i * 0.15, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

export function HeroStatBadges({ stats }: HeroStatBadgesProps) {
  const t = useTranslations("home");

  const badges = [
    { href: "/veilingen" as const, count: stats.activeAuctions, label: t("activeAuctions"), color: "bg-primary" },
    { href: "/claimsales" as const, count: stats.activeClaimsales, label: t("activeClaimsales"), color: "bg-amber-600" },
    { href: "/marktplaats" as const, count: stats.activeListings, label: t("activeListings"), color: "bg-emerald-600" },
  ];

  return (
    <div className="flex flex-col gap-2 mb-6">
      {badges.map((badge, i) => (
        <motion.div
          key={badge.href}
          custom={i}
          initial="hidden"
          animate="visible"
          variants={badgeVariants}
        >
          <Link
            href={badge.href}
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm p-1 pr-3 transition-all hover:bg-white/20 hover:scale-[1.02]"
          >
            <span className={`rounded-[calc(var(--radius)-0.25rem)] ${badge.color} px-2 py-1 text-xs font-bold text-white`}>
              {badge.count}
            </span>
            <span className="text-sm text-white/80">{badge.label}</span>
            <ArrowRight className="size-4 text-white/80" />
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
