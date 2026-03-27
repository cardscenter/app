"use client";

import { markAsRead, markAllAsRead } from "@/actions/notification";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Bell, Gavel, ShoppingBag, MessageCircle, Heart } from "lucide-react";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

function getIcon(type: string) {
  switch (type) {
    case "OUTBID":
    case "AUCTION_WON":
      return Gavel;
    case "ITEM_SOLD":
      return ShoppingBag;
    case "NEW_MESSAGE":
      return MessageCircle;
    case "WATCHLIST_ENDING":
      return Heart;
    default:
      return Bell;
  }
}

export function NotificationList({ notifications }: { notifications: NotificationItem[] }) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const hasUnread = notifications.some((n) => !n.read);

  async function handleMarkAllRead() {
    await markAllAsRead();
    router.refresh();
  }

  async function handleClick(notification: NotificationItem) {
    if (!notification.read) {
      await markAsRead(notification.id);
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
        const Icon = getIcon(n.type);
        const content = (
          <div
            className={`glass-subtle flex items-start gap-3 rounded-2xl p-4 transition-all ${
              !n.read ? "ring-1 ring-primary/20 bg-primary/5" : ""
            }`}
          >
            <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
              !n.read ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <p className={`text-sm ${!n.read ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>
                  {n.title}
                </p>
                <span className="ml-2 flex-shrink-0 text-[11px] text-muted-foreground">
                  {new Date(n.createdAt).toLocaleDateString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
            </div>
            {!n.read && (
              <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
            )}
          </div>
        );

        if (n.link) {
          return (
            <Link key={n.id} href={n.link} onClick={() => handleClick(n)} className="block hover:scale-[1.005] transition-transform">
              {content}
            </Link>
          );
        }

        return <div key={n.id}>{content}</div>;
      })}
    </div>
  );
}
