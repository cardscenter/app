"use client";

import { Bell, ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { getUnreadCount, getRecentNotifications, markAsRead } from "@/actions/notification";
import { localizeNotificationLink } from "@/lib/notification-display";
import { useRealtime } from "@/components/providers/realtime-provider";

type RecentNotification = Awaited<ReturnType<typeof getRecentNotifications>>[number];

const FLASH_DURATION_MS = 5000;
const SHAKE_DURATION_MS = 600;

export function NotificationBell() {
  const locale = useLocale();
  const t = useTranslations("notifications");
  const [count, setCount] = useState(0);
  const [recent, setRecent] = useState<RecentNotification[]>([]);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [flashing, setFlashing] = useState<RecentNotification | null>(null);
  const [shaking, setShaking] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeenIdRef = useRef<string | null>(null);
  const { subscribe } = useRealtime();

  const fetchRecent = useCallback(async () => {
    const items = await getRecentNotifications(4);
    setRecent(items);
    if (items.length > 0 && lastSeenIdRef.current === null) {
      lastSeenIdRef.current = items[0].id;
    }
  }, []);

  // Initial load + 30s polling als fallback
  useEffect(() => {
    getUnreadCount().then(setCount);
    fetchRecent();
    const interval = setInterval(() => {
      getUnreadCount().then(setCount);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchRecent]);

  // SSE: bij nieuwe notificatie → count update + shake + single-flash
  useEffect(() => {
    return subscribe("notification-created", async (event) => {
      if (event.type !== "notification-created") return;
      setCount(event.payload.unreadCount);

      // Fetch recent en pak de nieuwste (= net binnengekomen) om te flashen
      const items = await getRecentNotifications(4);
      setRecent(items);
      const newest = items[0];
      if (newest && newest.id !== lastSeenIdRef.current) {
        lastSeenIdRef.current = newest.id;
        setFlashing(newest);
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => setFlashing(null), FLASH_DURATION_MS);
      }

      setShaking(true);
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = setTimeout(() => setShaking(false), SHAKE_DURATION_MS);
    });
  }, [subscribe]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    };
  }, []);

  // Klik buiten popover → flash dichten als die open is
  useEffect(() => {
    if (!flashing) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFlashing(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [flashing]);

  async function handleNotificationClick(n: RecentNotification) {
    if (!n.read) {
      await markAsRead(n.id);
      setCount((c) => Math.max(0, c - 1));
      setRecent((rs) => rs.map((r) => (r.id === n.id ? { ...r, read: true } : r)));
    }
    setHoverOpen(false);
    setFlashing(null);
  }

  function dismissFlash(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setFlashing(null);
  }

  // Flash heeft voorrang op de hover-lijst. Tijdens de flash kan de
  // gebruiker met muis op de flash blijven hangen om te lezen / te klikken
  // — daarvoor pauzeren we de auto-close timer bij pointer-enter en
  // herstarten we bij pointer-leave.
  const showFlash = !!flashing;
  const showHoverList = hoverOpen && !flashing;

  function pauseFlashTimer() {
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
  }

  function resumeFlashTimer() {
    if (!flashing) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashing(null), FLASH_DURATION_MS);
  }

  return (
    <div
      ref={containerRef}
      className="relative shrink-0"
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") {
          pauseFlashTimer();
          setHoverOpen(true);
          fetchRecent();
        }
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") {
          setHoverOpen(false);
          resumeFlashTimer();
        }
      }}
    >
      <Link
        href={`/${locale}/dashboard/meldingen`}
        aria-label={t("title")}
        className={`relative block rounded-md p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white ${
          shaking ? "animate-bell-shake" : ""
        }`}
        title={t("title")}
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Link>

      {/* Hover-popover: outer-box met max 4 mini-cards binnenin */}
      {showHoverList && (
        <div role="dialog" className="absolute right-0 top-full z-50 pt-2">
          <div className="w-80 max-w-[calc(100vw-1rem)] rounded-xl border border-border bg-card p-3 text-sm text-foreground shadow-lg shadow-black/10">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("title")}
              </p>
              {count > 0 && (
                <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
                  {count} ongelezen
                </span>
              )}
            </div>

            {recent.length === 0 ? (
              <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                Nog geen meldingen.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {recent.map((n) => {
                  const Inner = (
                    <div
                      className={`rounded-lg border p-2.5 transition-colors ${
                        !n.read
                          ? "border-primary/30 bg-primary/5 ring-1 ring-primary/10 hover:bg-primary/10"
                          : "border-transparent bg-muted/30 hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${
                            !n.read ? "bg-primary" : "bg-muted-foreground/30"
                          }`}
                          aria-hidden
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-[10px] font-semibold uppercase tracking-wider ${
                              !n.read ? "text-primary" : "text-muted-foreground"
                            }`}
                          >
                            {formatRelative(n.createdAt)}
                          </p>
                          <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                            {n.title}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {n.body}
                          </p>
                        </div>
                        {n.link && (
                          <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        )}
                      </div>
                    </div>
                  );
                  // DB-links zijn deels wel/niet locale-prefixed — altijd
                  // normaliseren, anders 404 (zelfde fix als meldingen-lijst).
                  const localizedLink = localizeNotificationLink(n.link, locale);
                  return (
                    <li key={n.id}>
                      {localizedLink ? (
                        <Link
                          href={localizedLink}
                          onClick={() => handleNotificationClick(n)}
                          className="block"
                        >
                          {Inner}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleNotificationClick(n)}
                          className="block w-full text-left"
                        >
                          {Inner}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <Link
              href={`/${locale}/dashboard/meldingen`}
              onClick={() => setHoverOpen(false)}
              className="mt-3 block w-full rounded-md bg-primary px-3 py-2 text-center text-xs font-medium text-white hover:bg-primary-hover"
            >
              Alle meldingen bekijken
            </Link>
          </div>
        </div>
      )}

      {/* Flash-overlay: alleen de net binnengekomen notificatie */}
      {showFlash && flashing && (
        <div role="status" className="absolute right-0 top-full z-50 pt-2 animate-flash-in">
          <div className="w-80 max-w-[calc(100vw-1rem)] rounded-xl border border-primary/30 bg-card p-3 text-sm shadow-xl shadow-primary/10 ring-1 ring-primary/20">
            <div className="flex items-start gap-2">
              <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Nieuwe melding
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                  {flashing.title}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{flashing.body}</p>
                {flashing.link && (
                  <Link
                    href={localizeNotificationLink(flashing.link, locale)!}
                    onClick={() => handleNotificationClick(flashing)}
                    className="mt-2 inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-white hover:bg-primary-hover"
                  >
                    Bekijken
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
              <button
                type="button"
                onClick={dismissFlash}
                aria-label="Sluiten"
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelative(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Zojuist";
  if (diffMin < 60) return `${diffMin} min geleden`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} u geleden`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} d geleden`;
  return d.toLocaleDateString("nl-NL");
}
