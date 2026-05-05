"use client";

import { MessageCircle, X } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { getRecentConversations, getUnreadConversationCount } from "@/actions/message";
import { useRealtime } from "@/components/providers/realtime-provider";

type RecentConversation = Awaited<ReturnType<typeof getRecentConversations>>[number];

type FlashMessage = {
  conversationId: string;
  senderName: string;
  preview: string;
};

const FLASH_DURATION_MS = 5000;
const SHAKE_DURATION_MS = 600;

export function MessageIcon() {
  const locale = useLocale();
  const t = useTranslations("common");
  const [count, setCount] = useState(0);
  const [recent, setRecent] = useState<RecentConversation[]>([]);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [flashing, setFlashing] = useState<FlashMessage | null>(null);
  const [shaking, setShaking] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { subscribe } = useRealtime();

  const fetchRecent = useCallback(async () => {
    const items = await getRecentConversations(4);
    setRecent(items);
  }, []);

  // Initial load + 30s polling als fallback
  useEffect(() => {
    getUnreadConversationCount().then(setCount);
    fetchRecent();
    const interval = setInterval(() => {
      getUnreadConversationCount().then(setCount);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchRecent]);

  // SSE: nieuw bericht → count update + shake + single-flash
  useEffect(() => {
    return subscribe("new-message", (event) => {
      if (event.type !== "new-message") return;
      setCount(event.payload.unreadConversationCount);
      fetchRecent();

      setFlashing({
        conversationId: event.payload.conversationId,
        senderName: event.payload.senderName,
        preview: event.payload.preview,
      });
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setFlashing(null), FLASH_DURATION_MS);

      setShaking(true);
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = setTimeout(() => setShaking(false), SHAKE_DURATION_MS);
    });
  }, [subscribe, fetchRecent]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    };
  }, []);

  // Klik buiten container → flash dichten
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

  function dismissFlash(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setFlashing(null);
  }

  // Flash heeft voorrang op de hover-lijst. Tijdens de flash pauzeren we de
  // auto-close timer bij pointer-enter zodat de gebruiker rustig kan lezen
  // en klikken (op "Open chat" of het ×-knopje).
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
        href={`/${locale}/berichten`}
        aria-label={t("messages")}
        className={`relative block rounded-md p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white ${
          shaking ? "animate-bell-shake" : ""
        }`}
        title={t("messages")}
      >
        <MessageCircle className="h-5 w-5" />
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
                {t("messages")}
              </p>
              {count > 0 && (
                <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
                  {count} ongelezen
                </span>
              )}
            </div>

            {recent.length === 0 ? (
              <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                Nog geen berichten.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {recent.map((c) => (
                  <li key={c.conversationId}>
                    <Link
                      href={`/${locale}/berichten/${c.conversationId}`}
                      onClick={() => setHoverOpen(false)}
                      className={`block rounded-lg border p-2.5 transition-colors ${
                        c.hasUnread
                          ? "border-primary/30 bg-primary/5 ring-1 ring-primary/10 hover:bg-primary/10"
                          : "border-transparent bg-muted/30 hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${
                            c.hasUnread ? "bg-primary" : "bg-muted-foreground/30"
                          }`}
                          aria-hidden
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-[10px] font-semibold uppercase tracking-wider ${
                              c.hasUnread ? "text-primary" : "text-muted-foreground"
                            }`}
                          >
                            {formatRelative(c.lastMessageAt)}
                          </p>
                          <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                            {c.otherUserName}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {c.preview || <em>Geen bericht</em>}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <Link
              href={`/${locale}/berichten`}
              onClick={() => setHoverOpen(false)}
              className="mt-3 block w-full rounded-md bg-primary px-3 py-2 text-center text-xs font-medium text-white hover:bg-primary-hover"
            >
              Alle berichten bekijken
            </Link>
          </div>
        </div>
      )}

      {/* Flash-overlay: alleen het binnenkomende bericht */}
      {showFlash && flashing && (
        <div role="status" className="absolute right-0 top-full z-50 pt-2 animate-flash-in">
          <div className="w-80 max-w-[calc(100vw-1rem)] rounded-xl border border-primary/30 bg-card p-3 text-sm shadow-xl shadow-primary/10 ring-1 ring-primary/20">
            <div className="flex items-start gap-2">
              <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Nieuw bericht
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                  {flashing.senderName}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {flashing.preview || <em>Foto</em>}
                </p>
                <Link
                  href={`/${locale}/berichten/${flashing.conversationId}`}
                  onClick={() => setFlashing(null)}
                  className="mt-2 inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-white hover:bg-primary-hover"
                >
                  Open chat
                </Link>
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
  if (diffMin < 1) return "Nu";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}u`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}
