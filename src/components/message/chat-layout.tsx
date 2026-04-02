"use client";

import { useState } from "react";
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

export function ChatLayout({ conversations, activeConversationId, children }: ChatLayoutProps) {
  const t = useTranslations("chat");

  // Determine initial tab: if we have an active conversation, go to the tab it belongs to
  const getInitialTab = (): ChatTab => {
    if (!activeConversationId) return "inbox";
    const conv = conversations.find((c) => c.id === activeConversationId);
    if (!conv) return "active";
    if (conv.participantStatus === "ARCHIVED") return "archived";
    return "active";
  };

  const [activeTab, setActiveTab] = useState<ChatTab>(getInitialTab);
  const [searchQuery, setSearchQuery] = useState("");

  const tabs: { key: ChatTab; label: string; icon: React.ElementType }[] = [
    { key: "inbox", label: t("inbox"), icon: Inbox },
    { key: "active", label: t("ongoing"), icon: MessageSquare },
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
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden border-t border-border">
      {/* Left panel: conversation list */}
      <div className="flex w-80 flex-shrink-0 flex-col border-r border-border bg-background lg:w-96">
        {/* Tabs */}
        <div className="flex border-b border-border bg-muted/30">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const badge = getBadge(tab.key);
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-3 text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                {badge !== null && (
                  <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                    {badge}
                  </span>
                )}
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

      {/* Right panel: active conversation */}
      <div className="flex flex-1 flex-col overflow-hidden bg-background">
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
