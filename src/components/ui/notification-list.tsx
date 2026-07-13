"use client";

import { useState } from "react";
import { markAsRead, markAllAsRead } from "@/actions/notification";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import {
  NOTIFICATION_TONE_CLASSES,
  resolveNotificationMeta,
} from "@/lib/notification-display";
import { NotificationDetailModal } from "@/components/ui/notification-detail-modal";

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
 * Meldingen-lijst (Fase 44-rewrite). Klik opent een detail-popup met
 * uitgebreide uitleg per melding i.p.v. direct te navigeren — de oude
 * directe links gaven bovendien 404 door inconsistente locale-prefixes
 * in de DB. Kleuren volgen de site-branding (veilingen blauw, claimsales
 * amber, marktplaats groen, annuleringen/boetes rose).
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
          <button
            onClick={handleMarkAllRead}
            className="text-sm font-medium text-primary hover:underline"
          >
            {t("markAllRead")}
          </button>
        </div>
      )}

      {notifications.map((n) => {
        const meta = resolveNotificationMeta(n);
        const tone = NOTIFICATION_TONE_CLASSES[meta.tone];
        const Icon = meta.icon;

        return (
          <button
            key={n.id}
            type="button"
            onClick={() => handleOpen(n)}
            className="block w-full text-left"
          >
            <div
              className={`flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover ${
                !n.read ? "border-primary/25 bg-primary/[0.03]" : "border-border"
              }`}
            >
              <div
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${tone.iconWrap}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <p
                      className={`truncate text-sm ${
                        !n.read ? "font-semibold text-foreground" : "font-medium text-foreground"
                      }`}
                    >
                      {n.title}
                    </p>
                    <span
                      className={`hidden flex-shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium sm:inline-flex ${tone.pill}`}
                    >
                      {meta.category}
                    </span>
                  </div>
                  <span className="flex-shrink-0 text-[11px] text-muted-foreground">
                    {new Date(n.createdAt).toLocaleDateString("nl-NL", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1.5 self-center">
                {!n.read && <div className="h-2 w-2 rounded-full bg-primary" />}
                <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
              </div>
            </div>
          </button>
        );
      })}

      {selected && (
        <NotificationDetailModal
          notification={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
