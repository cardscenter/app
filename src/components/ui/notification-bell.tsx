"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { getUnreadCount } from "@/actions/notification";

export function NotificationBell() {
  const locale = useLocale();
  const t = useTranslations("notifications");
  const [count, setCount] = useState(0);

  useEffect(() => {
    getUnreadCount().then(setCount);
    // Poll every 30 seconds
    const interval = setInterval(() => {
      getUnreadCount().then(setCount);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Link
      href={`/${locale}/dashboard/meldingen`}
      className="relative rounded-md p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
      title={t("title")}
    >
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
