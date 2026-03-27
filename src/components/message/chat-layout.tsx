"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Inbox, MessageSquare, Archive, Trash2 } from "lucide-react";
import { ConversationList } from "./conversation-list";
import { ChatActions } from "./chat-actions";

export type ChatTab = "inbox" | "active" | "archived" | "deleted";

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
  const [activeTab, setActiveTab] = useState<ChatTab>("inbox");
  const [searchQuery, setSearchQuery] = useState("");

  const tabs: { key: ChatTab; label: string; icon: React.ElementType }[] = [
    { key: "inbox", label: t("inbox"), icon: Inbox },
    { key: "active", label: t("ongoing"), icon: MessageSquare },
    { key: "archived", label: t("archived"), icon: Archive },
    { key: "deleted", label: t("deleted"), icon: Trash2 },
  ];

  // Filter conversations by tab
  const filtered = conversations.filter((c) => {
    if (activeTab === "inbox") return c.participantStatus === "ACTIVE" && c.hasUnread;
    if (activeTab === "active") return c.participantStatus === "ACTIVE";
    if (activeTab === "archived") return c.participantStatus === "ARCHIVED";
    if (activeTab === "deleted") return c.participantStatus === "DELETED";
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
  const archivedCount = conversations.filter((c) => c.participantStatus === "ARCHIVED").length;
  const deletedCount = conversations.filter((c) => c.participantStatus === "DELETED").length;

  function getBadge(tab: ChatTab): number | null {
    if (tab === "inbox" && unreadCount > 0) return unreadCount;
    if (tab === "archived" && archivedCount > 0) return archivedCount;
    if (tab === "deleted" && deletedCount > 0) return deletedCount;
    return null;
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left panel: conversation list */}
      <div className="flex w-80 flex-shrink-0 flex-col border-r border-border lg:w-96">
        {/* Tabs */}
        <div className="flex border-b border-border">
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
        <div className="p-3">
          <input
            type="text"
            placeholder={t("search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full glass-input px-3 py-2 text-sm text-foreground"
          />
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {displayed.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {t("noConversations")}
            </div>
          ) : (
            <ConversationList
              conversations={displayed}
              activeId={activeConversationId}
              showActions={activeTab === "archived" || activeTab === "deleted"}
              tab={activeTab}
            />
          )}
        </div>
      </div>

      {/* Right panel: active conversation */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {activeConversationId ? (
          <>
            {/* Action bar for active conversation */}
            <div className="flex items-center justify-end border-b border-border px-4 py-2">
              <ChatActions
                conversationId={activeConversationId}
                status={conversations.find((c) => c.id === activeConversationId)?.participantStatus ?? "ACTIVE"}
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>
          </>
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
