"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Inbox, MessageSquare, Archive } from "lucide-react";
import { ConversationList } from "./conversation-list";

export type ChatTab = "inbox" | "active" | "archived";

export type ConversationPreview = {
  id: string;
  otherUserName: string;
  otherUserInitial: string;
  lastMessage: string | null;
  lastMessageDate: string | null;
  context: string | null;
  contextType: "auction" | "claimsale" | "listing" | null;
  hasUnread: boolean;
  participantStatus: string;
};

interface ChatLayoutProps {
  conversations: ConversationPreview[];
  activeConversationId?: string;
  children: React.ReactNode; // The active conversation content
}

// Compacte handtekening voor change-detection — verandert wanneer er een
// nieuwe conversation is, ongelezen-status flipt, of laatste-bericht wijzigt.
function buildSignature(convs: ConversationPreview[]): string {
  return convs.map((c) => `${c.id}:${c.lastMessage ?? ""}:${c.hasUnread}:${c.participantStatus}`).join("|");
}

export function ChatLayout({ conversations: initialConversations, activeConversationId, children }: ChatLayoutProps) {
  const t = useTranslations("chat");

  // Live conversation-list (Fase 27.57): polling refresht de lijst zodat
  // nieuwe gesprekken + ongelezen-status binnenkomen zonder page-reload.
  // Zelfde cadence-pattern als chat-message polling (5s/15s + visibility).
  const [conversations, setConversations] = useState(initialConversations);
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

  // Tab-volgorde matcht de prioriteit: Lopend (default + meest gebruikt) eerst,
  // dan Inbox (ongelezen), dan Archief.
  const tabs: { key: ChatTab; label: string; icon: React.ElementType }[] = [
    { key: "active", label: t("ongoing"), icon: MessageSquare },
    { key: "inbox", label: t("inbox"), icon: Inbox },
    { key: "archived", label: t("archived"), icon: Archive },
  ];

  // Filter conversations by tab
  const filtered = conversations.filter((c) => {
    if (activeTab === "inbox") return c.participantStatus === "ACTIVE" && c.hasUnread;
    if (activeTab === "active") return c.participantStatus === "ACTIVE";
    if (activeTab === "archived") return c.participantStatus === "ARCHIVED";
    return false;
  });

  // Search filter
  const displayed = searchQuery
    ? filtered.filter(
        (c) =>
          c.otherUserName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.context?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filtered;

  // Count badges
  const unreadCount = conversations.filter((c) => c.participantStatus === "ACTIVE" && c.hasUnread).length;
  function getBadge(tab: ChatTab): number | null {
    if (tab === "inbox" && unreadCount > 0) return unreadCount;
    return null;
  }

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden border-t border-border">
      {/* Left panel: conversation list. Op mobile: full-width als er geen actief
          gesprek is, anders verborgen (de chat-thread neemt dan de hele
          viewport). Op md+: altijd zichtbaar als sidebar. */}
      <div
        className={`${activeConversationId ? "hidden md:flex" : "flex"} w-full flex-shrink-0 flex-col border-r border-border bg-background md:w-80 lg:w-96`}
      >
        {/* Tabs — vertical stack op mobile (icoon boven, label onder) zodat
            de tekst leesbaar blijft op een smal scherm. Vanaf sm horizontaal. */}
        <div className="flex border-b border-border bg-muted/30">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const badge = getBadge(tab.key);
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium transition-colors sm:flex-row sm:gap-1.5 sm:px-2 sm:py-3 ${
                  activeTab === tab.key
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {/* Icon + badge in één rij zodat de badge op mobile boven de
                    label blijft (en niet onder de label inschuift bij flex-col). */}
                <div className="flex items-center gap-1">
                  <Icon className="h-4 w-4" />
                  {badge !== null && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                      {badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] leading-tight sm:text-xs">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="p-3 border-b border-border">
          <input
            type="text"
            placeholder={t("search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "archived" && (
            <div className="mx-3 mt-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 px-3 py-2">
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                {t("archiveAutoDeleteNotice")}
              </p>
            </div>
          )}
          {displayed.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {t("noConversations")}
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
      </div>

      {/* Right panel: active conversation. Op mobile alleen tonen als er een
          actief gesprek is (anders zou de "Selecteer een gesprek"-empty state
          de lijst overdekken). Op md+: altijd zichtbaar. */}
      <div
        className={`${activeConversationId ? "flex" : "hidden md:flex"} flex-1 flex-col overflow-hidden bg-background`}
      >
        {activeConversationId ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            {children}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="mx-auto h-12 w-12 opacity-30" />
              <p className="mt-3 text-sm">{t("selectConversation")}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
