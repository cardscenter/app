"use client";

import { useState } from "react";
import { markAsRead, markAllAsRead } from "@/actions/notification";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCheck, ChevronRight } from "lucide-react";
import { resolveNotificationMeta } from "@/lib/notification-display";
import { NotificationDetailModal, NOTIFICATION_DASH_TONE } from "@/components/ui/notification-detail-modal";
import { TONE_ICON } from "@/components/dashboard/ui/tones";
import { PILL_BTN_SM } from "@/components/ploy/tile-styles";
import { cn } from "@/lib/utils";

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
 * Meldingen-lijst (Fase 44-rewrite, design-pass ronde G). Klik opent een
 * detail-popup met uitgebreide uitleg per melding i.p.v. direct te
 * navigeren; de oude directe links gaven bovendien 404 door inconsistente
 * locale-prefixes in de DB. De categorie bepaalt de pastel-toon van het icoon.
 */
export function NotificationList({ notifications }: { notifications: NotificationItem[] }) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [selected, setSelected] = useState<NotificationItem | null>(null);
  const hasUnread = notifications.some((n) => !n.read);

  async function handleMarkAllRead() {
    await markAllAsRead();
    router.refresh();
  }

  function handleOpen(notification: NotificationItem) {
    setSelected(notification);
    if (!notification.read) {
      // Fire-and-forget: modal hoeft hier niet op te wachten.
      markAsRead(notification.id).then(() => router.refresh());
    }
  }

  return (
    <div className="space-y-3">
      {hasUnread && (
        <div className="flex justify-end">
          <button type="button" onClick={handleMarkAllRead} className={PILL_BTN_SM}>
            <CheckCheck className="size-3.5" />
            {t("markAllRead")}
          </button>
        </div>
      )}

      {notifications.map((n) => {
        const meta = resolveNotificationMeta(n);
        const tone = NOTIFICATION_DASH_TONE[meta.tone];
        const Icon = meta.icon;

        return (
          <button key={n.id} type="button" onClick={() => handleOpen(n)} className="block w-full text-left">
            <div
              className={cn(
                "dash-card flex items-start gap-3 p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-card-hover",
                !n.read && "ring-2 ring-[var(--pastel-yellow)]",
              )}
            >
              <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", TONE_ICON[tone])}>
                <Icon className="size-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className={cn("truncate text-sm text-foreground", !n.read ? "font-semibold" : "font-medium")}>{n.title}</p>
                    <span className="cc-pill hidden shrink-0 items-center bg-[var(--background)] px-2.5 py-1 text-[11px] font-semibold leading-none text-foreground/70 sm:inline-flex">
                      {meta.category}
                    </span>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {new Date(n.createdAt).toLocaleDateString("nl-NL", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{n.body}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 self-center">
                {!n.read && <span className="cc-grad size-2 rounded-full" />}
                <ChevronRight className="size-4 text-foreground/35" />
              </div>
            </div>
          </button>
        );
      })}

      {selected && <NotificationDetailModal notification={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
