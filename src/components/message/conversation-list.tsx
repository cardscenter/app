"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import type { ConversationPreview, ChatTab } from "./chat-layout";
import { ChatActions } from "./chat-actions";

interface ConversationListProps {
  conversations: ConversationPreview[];
  activeId?: string;
  showActions: boolean;
  tab: ChatTab;
}

export function ConversationList({ conversations, activeId, showActions, tab }: ConversationListProps) {
  const locale = useLocale();

  return (
    <div className="divide-y divide-border">
      {conversations.map((conv) => {
        const isActive = conv.id === activeId;
        return (
          <div key={conv.id} className="relative group">
            <Link
              href={`/${locale}/berichten/${conv.id}`}
              className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                isActive
                  ? "bg-primary/5 dark:bg-primary/10"
                  : "hover:bg-muted/50"
              }`}
            >
              {/* Avatar */}
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                conv.hasUnread ? "bg-primary" : "bg-muted-foreground/40"
              }`}>
                {conv.otherUserInitial}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className={`text-sm truncate ${
                    conv.hasUnread ? "font-semibold text-foreground" : "font-medium text-foreground"
                  }`}>
                    {conv.otherUserName}
                  </span>
                  <span className="ml-2 flex-shrink-0 text-[11px] text-muted-foreground">
                    {conv.lastMessageDate}
                  </span>
                </div>

                {conv.context && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {conv.contextType === "auction" ? "Veiling" : conv.contextType === "claimsale" ? "Claimsale" : "Marktplaats"}: {conv.context}
                  </p>
                )}

                {conv.lastMessage && (
                  <p className={`mt-0.5 truncate text-xs ${
                    conv.hasUnread ? "text-foreground" : "text-muted-foreground"
                  }`}>
                    {conv.lastMessage}
                  </p>
                )}
              </div>

              {/* Unread dot */}
              {conv.hasUnread && (
                <div className="mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-primary" />
              )}
            </Link>

            {/* Hover actions for archive/deleted tabs */}
            {showActions && (
              <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <ChatActions conversationId={conv.id} status={conv.participantStatus} compact />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
