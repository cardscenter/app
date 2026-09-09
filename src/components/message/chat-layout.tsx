"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Inbox, MessageSquare, Archive, Search } from "lucide-react";
import { ConversationList } from "./conversation-list";
import type { ConversationPreview } from "@/lib/conversation-types";

export type { ConversationPreview } from "@/lib/conversation-types";
export type ChatTab = "inbox" | "active" | "archived";

interface ChatLayoutProps {
  conversations: ConversationPreview[];
  activeConversationId?: string;
  children: React.ReactNode; // The active conversation content
}

// Berichten in TailAdmin-stijl (sept 2026): schermvullend (geen sidebar),
// links de gesprekslijst (zoek + segment-tabs), rechts het open gesprek. Route-based
// op mobiel: /berichten = lijst, /berichten/[id] = gesprek met terugknop.

// Compacte handtekening voor change-detection — verandert wanneer er een
// nieuwe conversation is, ongelezen-status flipt, of laatste-bericht wijzigt.
function buildSignature(convs: ConversationPreview[]): string {
  return convs.map((c) => `${c.id}:${c.lastMessageAt ?? ""}:${c.hasUnread}:${c.participantStatus}`).join("|");
}

export function ChatLayout({ conversations: initialConversations, activeConversationId, children }: ChatLayoutProps) {
  const t = useTranslations("chat");

  // Live conversation-list (Fase 27.57): polling refresht de lijst zodat
  // nieuwe gesprekken + ongelezen-status binnenkomen zonder page-reload.
  // Zelfde cadence-pattern als chat-message polling (5s/15s + visibility).
  const [conversations, setConversations] = useState(initialConversations);
  const [listProp, setListProp] = useState(initialConversations);
  if (listProp !== initialConversations) {
    // Nieuwe server-data (router.refresh / navigatie) wint van de poll-cache.
    setListProp(initialConversations);
    setConversations(initialConversations);
  }
  const visibleRef = useRef(typeof document !== "undefined" ? !document.hidden : true);
  const fetchingRef = useRef(false);
  const emptyPollsRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSignatureRef = useRef<string>(buildSignature(initialConversations));

  useEffect(() => {
    function schedule() {
      if (intervalRef.current) clearTimeout(intervalRef.current);
      const delay = emptyPollsRef.current >= 3 ? 15000 : 5000;
      intervalRef.current = setTimeout(tick, delay);
    }
    async function tick() {
      if (!visibleRef.current || fetchingRef.current) {
        schedule();
        return;
      }
      fetchingRef.current = true;
      try {
        const res = await fetch("/api/conversations");
        if (!res.ok) {
          schedule();
          return;
        }
        const data: { conversations: ConversationPreview[] } = await res.json();
        const sig = buildSignature(data.conversations);
        if (sig !== lastSignatureRef.current) {
          lastSignatureRef.current = sig;
          setConversations(data.conversations);
          emptyPollsRef.current = 0;
        } else {
          emptyPollsRef.current += 1;
        }
      } catch {
        // Silent — volgende tick probeert opnieuw
      } finally {
        fetchingRef.current = false;
        schedule();
      }
    }
    function onVisibility() {
      visibleRef.current = !document.hidden;
      if (visibleRef.current) {
        emptyPollsRef.current = 0;
        if (intervalRef.current) clearTimeout(intervalRef.current);
        tick();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    schedule();
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, []);

  // Default landt op "Lopend" — dat is waar de meeste gebruikers heen willen.
  // Inbox blijft als aparte tab voor enkel ongelezen items, met badge-counter.
  const getInitialTab = (): ChatTab => {
    if (!activeConversationId) return "active";
    const conv = conversations.find((c) => c.id === activeConversationId);
    if (!conv) return "active";
    if (conv.participantStatus === "ARCHIVED") return "archived";
    return "active";
  };

  const [activeTab, setActiveTab] = useState<ChatTab>(getInitialTab);
  const [searchQuery, setSearchQuery] = useState("");

  const tabs: { key: ChatTab; label: string; icon: React.ElementType }[] = [
    { key: "active", label: t("ongoing"), icon: MessageSquare },
    { key: "inbox", label: t("inbox"), icon: Inbox },
    { key: "archived", label: t("archived"), icon: Archive },
  ];

  const filtered = conversations.filter((c) => {
    if (activeTab === "inbox") return c.participantStatus === "ACTIVE" && c.hasUnread;
    if (activeTab === "active") return c.participantStatus === "ACTIVE";
    if (activeTab === "archived") return c.participantStatus === "ARCHIVED";
    return false;
  });

  const q = searchQuery.trim().toLowerCase();
  const displayed = q
    ? filtered.filter(
        (c) =>
          c.otherUserName.toLowerCase().includes(q) ||
          (c.otherUserHandle ?? "").toLowerCase().includes(q) ||
          c.context?.toLowerCase().includes(q) ||
          c.lastMessage?.toLowerCase().includes(q),
      )
    : filtered;

  const unreadCount = conversations.filter((c) => c.participantStatus === "ACTIVE" && c.hasUnread).length;

  const emptyLabel = q
    ? t("noResults")
    : activeTab === "inbox"
      ? t("emptyInbox")
      : activeTab === "archived"
        ? t("emptyArchived")
        : t("emptyActive");

  return (
    <section className="flex min-h-0 flex-1 overflow-hidden border-x border-t border-border bg-card">
      {/* Links: gesprekslijst. Mobiel full-width als er geen gesprek open is. */}
      <aside
        className={`${activeConversationId ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-border md:w-80 md:border-r lg:w-[22rem]`}
      >
        <div className="space-y-2.5 border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder={t("search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-border bg-muted/40 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="grid grid-cols-3 gap-0.5 rounded-md bg-muted p-0.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              const badge = tab.key === "inbox" && unreadCount > 0 ? unreadCount : null;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  aria-pressed={active}
                  className={`flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors ${
                    active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="size-3.5 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                  {badge !== null && (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {activeTab === "archived" && (
            <p className="mx-3 mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
              {t("archiveAutoDeleteNotice")}
            </p>
          )}
          {displayed.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                <MessageSquare className="size-5 text-muted-foreground" />
              </span>
              <p className="text-sm text-muted-foreground">{emptyLabel}</p>
            </div>
          ) : (
            <ConversationList
              conversations={displayed}
              activeId={activeConversationId}
              showActions={activeTab === "archived"}
              tab={activeTab}
            />
          )}
        </div>
      </aside>

      {/* Rechts: het open gesprek (mobiel alleen als er één gekozen is) */}
      <div className={`${activeConversationId ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col overflow-hidden`}>
        {activeConversationId ? (
          children
        ) : (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-muted">
                <MessageSquare className="size-7 text-muted-foreground" />
              </span>
              <p className="text-sm text-muted-foreground">{t("selectConversation")}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
