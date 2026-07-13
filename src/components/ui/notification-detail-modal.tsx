"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useLocale } from "next-intl";
import { ArrowRight, X } from "lucide-react";
import {
  NOTIFICATION_TONE_CLASSES,
  buildNotificationDetail,
  localizeNotificationLink,
  resolveNotificationMeta,
} from "@/lib/notification-display";

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
  const meta = resolveNotificationMeta(notification);
  const detail = buildNotificationDetail(notification);
  const tone = NOTIFICATION_TONE_CLASSES[meta.tone];
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
        className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-card-hover sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header met tint in de categorie-kleur */}
        <div className={`flex items-start gap-3 border-b border-border px-5 py-4 ${tone.headerBar}`}>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.iconWrap}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tone.pill}`}
            >
              {meta.category}
            </span>
            <h2 className="mt-1.5 text-base font-semibold leading-snug text-foreground">
              {notification.title}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{fullDate}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollbare inhoud */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* De volledige originele melding — bevat de specifieke bedragen/ordernummers */}
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
              {notification.body}
            </p>
          </div>

          {/* Uitgebreide uitleg */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Wat betekent dit?
            </h3>
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
                    <span
                      className={`mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`}
                      aria-hidden
                    />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Sluiten
          </button>
          {href && (
            <Link
              href={href}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
            >
              {detail.linkLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
