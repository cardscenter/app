"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { Gavel, Tag, Store, MessageCircle, Bell, AlertTriangle, CreditCard, Package, XCircle, MapPin } from "lucide-react";
import type { HomepageStats } from "@/lib/homepage-data";
import type { ActionItemsCounts } from "@/lib/dashboard-queries";

interface LoggedInHeroV2Props {
  userName: string;
  stats: HomepageStats;
  bannerSrc: string;
  actionItems: ActionItemsCounts | null;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("nl-NL").format(Math.round(n));
}

export function LoggedInHeroV2({ userName, stats, bannerSrc, actionItems }: LoggedInHeroV2Props) {
  const t = useTranslations("home");
  const tActions = useTranslations("dashboard.essentials.actionItems");

  // Fase 37: éénmalige "Welkom," ipv "Welkom terug," direct na registratie.
  // localStorage-flag wordt door register-form.tsx gezet en hier consumed+gewist.
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem("cards-center-new-user") === "1") {
        setIsFirstVisit(true);
        window.localStorage.removeItem("cards-center-new-user");
      }
    } catch {
      // Stille faal — localStorage kan disabled zijn.
    }
  }, []);

  return (
    <section className="relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0">
        <Image
          src={bannerSrc}
          alt={t("heroV2ImageAlt")}
          fill
          sizes="100vw"
          className="object-cover object-[75%_center]"
          priority
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(2,6,23,0.95) 0%, rgba(2,6,23,0.85) 30%, rgba(2,6,23,0.55) 60%, rgba(2,6,23,0.25) 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-slate-950/80 to-transparent"
        />
      </div>

      <div className="relative mx-auto w-full max-w-[1680px] px-4 py-20 sm:px-6 lg:px-8 lg:py-32 xl:px-10 xl:py-36">
        <div className="max-w-xl lg:max-w-2xl">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-xs font-medium uppercase tracking-[0.18em] text-slate-300"
          >
            {isFirstVisit ? t("heroLoggedInEyebrowNew") : t("heroLoggedInEyebrow")}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="mt-5 text-balance text-4xl font-semibold tracking-tight text-white drop-shadow-sm sm:text-5xl lg:text-6xl xl:text-7xl"
          >
            {isFirstVisit
              ? t("welcomeFirstTime", { name: userName })
              : t("welcomeBack", { name: userName })}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-6 max-w-md text-base text-slate-200 sm:text-lg"
          >
            {t("heroLoggedInSubtitle")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
          >
            <Link
              href="/veilingen/nieuw"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-white shadow-lg shadow-primary/30 transition-colors hover:bg-primary-hover"
            >
              <Gavel className="size-4" />
              {t("createAuction")}
            </Link>
            <Link
              href="/claimsales/nieuw"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-amber-600/30 transition-colors hover:bg-amber-700"
            >
              <Tag className="size-4" />
              {t("createClaimsale")}
            </Link>
            <Link
              href="/marktplaats/nieuw"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-emerald-600/30 transition-colors hover:bg-emerald-700"
            >
              <Store className="size-4" />
              {t("createListing")}
            </Link>
          </motion.div>

          {/* Sinds je vorige bezoek — alleen tonen als er werkelijk actie-items
              zijn EN het niet de eerste login is (Fase 37). */}
          {!isFirstVisit && actionItems && <SinceLastVisitStrip counts={actionItems} t={t} tActions={tActions} />}

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="mt-8 flex flex-wrap gap-2"
          >
            <StatPill value={formatNumber(stats.activeAuctions)} label={t("activeAuctions")} />
            <StatPill value={formatNumber(stats.activeClaimsales)} label={t("activeClaimsales")} />
            <StatPill value={formatNumber(stats.activeListings)} label={t("activeListings")} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs ring-1 ring-white/20 backdrop-blur">
      <span className="font-semibold text-white">{value}</span>
      <span className="text-slate-300">{label}</span>
    </span>
  );
}

/* ============================================================
   SinceLastVisitStrip — Fase 37
   ============================================================
   Toont action-items chips onder de hero CTA-knoppen. Hergebruikt dezelfde
   counts als de dashboard "Actie nodig"-widget, maar dark-themed voor de
   hero-context. Verbergt zich automatisch als alle counts 0 zijn. */

type SinceLastVisitItem = {
  key: keyof ActionItemsCounts;
  count: number;
  href: string;
  Icon: typeof MessageCircle;
  ring: string;
  iconColor: string;
};

function SinceLastVisitStrip({
  counts,
  t,
  tActions,
}: {
  counts: ActionItemsCounts;
  t: (key: string) => string;
  tActions: (key: string) => string;
}) {
  const items: SinceLastVisitItem[] = [
    {
      key: "unreadConversations",
      count: counts.unreadConversations,
      href: "/berichten",
      Icon: MessageCircle,
      ring: "ring-sky-400/40",
      iconColor: "text-sky-300",
    },
    {
      key: "unreadNotifications",
      count: counts.unreadNotifications,
      href: "/dashboard/meldingen",
      Icon: Bell,
      ring: "ring-amber-400/40",
      iconColor: "text-amber-300",
    },
    {
      key: "openDisputes",
      count: counts.openDisputes,
      href: "/dashboard/geschillen",
      Icon: AlertTriangle,
      ring: "ring-red-400/40",
      iconColor: "text-red-300",
    },
    {
      key: "awaitingPaymentAuctions",
      count: counts.awaitingPaymentAuctions,
      href: "/dashboard/aankopen",
      Icon: CreditCard,
      ring: "ring-orange-400/40",
      iconColor: "text-orange-300",
    },
    {
      key: "runnerUpOffers",
      count: counts.runnerUpOffers,
      href: "/dashboard/aankopen",
      Icon: Gavel,
      ring: "ring-indigo-400/40",
      iconColor: "text-indigo-300",
    },
    {
      key: "bundlesToShip",
      count: counts.bundlesToShip,
      href: "/dashboard/verkopen",
      Icon: Package,
      ring: "ring-emerald-400/40",
      iconColor: "text-emerald-300",
    },
    {
      key: "pendingCancellations",
      count: counts.pendingCancellations,
      href: "/dashboard/aankopen",
      Icon: XCircle,
      ring: "ring-purple-400/40",
      iconColor: "text-purple-300",
    },
    {
      key: "pendingPickups",
      count: counts.pendingPickups,
      href: "/dashboard/aankopen",
      Icon: MapPin,
      ring: "ring-sky-400/40",
      iconColor: "text-sky-300",
    },
  ];

  const visible = items.filter((i) => i.count > 0);
  if (visible.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.32 }}
      className="mt-8"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-300">
        {t("heroSinceLastVisit")}
      </p>
      <div className="flex flex-wrap gap-2">
        {visible.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={`group inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm ring-1 ${item.ring} backdrop-blur transition-colors hover:bg-white/15`}
          >
            <item.Icon className={`size-4 ${item.iconColor}`} />
            <span className="font-bold text-white">{item.count}</span>
            <span className="text-slate-200">{tActions(item.key)}</span>
          </Link>
        ))}
      </div>
    </motion.div>
  );
}
