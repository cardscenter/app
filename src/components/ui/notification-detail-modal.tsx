"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, X } from "lucide-react";
import {
  buildNotificationDetail,
  localizeNotificationLink,
  resolveNotificationMeta,
  type NotificationTone,
} from "@/lib/notification-display";
import { TONE_SURFACE, type DashTone } from "@/components/dashboard/ui/tones";
import { PILL_BTN } from "@/components/ploy/tile-styles";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

/** Categorie-kleur van een melding → pastel-toon van de design-pass. */
export const NOTIFICATION_DASH_TONE: Record<NotificationTone, DashTone> = {
  blue: "blue",
  sky: "blue",
  amber: "yellow",
  emerald: "green",
  rose: "pink",
  violet: "pink",
  slate: "neutral",
};

/** Bolletje voor de opsommingstekens in de uitleg. */
const BULLET_DOT: Record<DashTone, string> = {
  pink: "bg-[var(--pastel-pink-ink)]",
  yellow: "bg-[var(--pastel-yellow-ink)]",
  blue: "bg-[var(--pastel-blue-ink)]",
  green: "bg-[var(--pastel-green-ink)]",
  ink: "bg-[var(--foreground)]",
  red: "bg-[var(--primary)]",
  neutral: "bg-[var(--foreground)]/40",
};

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

/**
 * Detail-popup voor één melding (Fase 44). Toont de volledige melding plus
 * een uitgebreide "Wat betekent dit?"-uitleg per meldingstype, en een
 * doorlink-knop naar de bijbehorende pagina. Portal + body-scroll-lock
 * zodat de modal boven elke stacking-context rendert.
 */
export function NotificationDetailModal({
  notification,
  onClose,
}: {
  notification: NotificationItem;
  onClose: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("notifications");
  const meta = resolveNotificationMeta(notification);
  const detail = buildNotificationDetail(notification);
  const tone = NOTIFICATION_DASH_TONE[meta.tone];
  const href = localizeNotificationLink(notification.link, locale);
  const Icon = meta.icon;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const fullDate = new Date(notification.createdAt).toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={notification.title}
    >
      <div
        className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[20px] bg-white shadow-card-hover sm:max-w-lg sm:rounded-[20px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Kop in de pastel van de categorie */}
        <div className={cn("flex items-start gap-3 px-5 py-4", tone === "neutral" ? "bg-[var(--background)] text-foreground" : TONE_SURFACE[tone])}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/70">
            <Icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="cc-pill inline-flex items-center bg-white/70 px-2.5 py-1 text-[11px] font-semibold leading-none">{meta.category}</span>
            <h2 className="mt-2 text-lg font-semibold leading-snug tracking-[-0.03em]">{notification.title}</h2>
            <p className="mt-0.5 text-xs opacity-70">{fullDate}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/70 transition-colors hover:bg-white"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollbare inhoud */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* De volledige originele melding: bevat de specifieke bedragen/ordernummers */}
          <div className="rounded-[14px] bg-[var(--background)] px-4 py-3">
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{notification.body}</p>
          </div>

          {/* Uitgebreide uitleg */}
          <div>
            <h3 className="text-base font-semibold tracking-[-0.02em] text-foreground">{t("whatMeans")}</h3>
            <div className="mt-2 space-y-2.5">
              {detail.paragraphs.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
            </div>
            {detail.bullets && detail.bullets.length > 0 && (
              <ul className="mt-3 space-y-2">
                {detail.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                    <span className={cn("mt-2 inline-block size-1.5 shrink-0 rounded-full", BULLET_DOT[tone])} aria-hidden />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5">
          <button type="button" onClick={onClose} className={PILL_BTN}>
            {t("close")}
          </button>
          {href && (
            <Link href={href} onClick={onClose} className={buttonVariants()}>
              {detail.linkLabel}
              <ArrowRight className="size-4" />
            </Link>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
