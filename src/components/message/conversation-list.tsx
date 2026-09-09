"use client";

import { Link } from "@/i18n/navigation";
import { useFormatter, useTranslations } from "next-intl";
import type { ConversationPreview } from "@/lib/conversation-types";
import type { ChatTab } from "./chat-layout";
import { ChatActions } from "./chat-actions";
import { ChatAvatar } from "./chat-avatar";

interface ConversationListProps {
  conversations: ConversationPreview[];
  activeId?: string;
  showActions: boolean;
  tab: ChatTab;
}

/** Vandaag → tijd, dit jaar → "8 sep", ouder → "8 sep 2025". */
function useListTime() {
  const format = useFormatter();
  return (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return format.dateTime(d, { hour: "2-digit", minute: "2-digit" });
    if (d.getFullYear() === now.getFullYear()) return format.dateTime(d, { day: "numeric", month: "short" });
    return format.dateTime(d, { day: "numeric", month: "short", year: "numeric" });
  };
}

export function ConversationList({ conversations, activeId, showActions }: ConversationListProps) {
  const t = useTranslations("chat");
  const listTime = useListTime();
  const ctxLabel = { auction: t("ctxAuction"), claimsale: t("ctxClaimsale"), listing: t("ctxListing") } as const;

  return (
    <ul className="divide-y divide-border">
      {conversations.map((conv) => {
        const isActive = conv.id === activeId;
        return (
          <li key={conv.id} className="group relative">
            <Link
              href={`/berichten/${conv.id}`}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-start gap-3 border-l-2 py-2.5 pl-[10px] pr-3 transition-colors ${
                isActive ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/40"
              }`}
            >
              <ChatAvatar src={conv.otherUserAvatar} initial={conv.otherUserInitial} emphasis={conv.hasUnread} />

              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <span className={`truncate text-sm ${conv.hasUnread ? "font-semibold" : "font-medium"} text-foreground`}>
                      {conv.otherUserName || t("user")}
                    </span>
                    {conv.otherUserHandle && (
                      <span className="shrink-0 truncate text-[11px] text-muted-foreground">{conv.otherUserHandle}</span>
                    )}
                  </span>
                  <span className={`shrink-0 text-[11px] tabular-nums ${conv.hasUnread ? "font-medium text-primary" : "text-muted-foreground"}`}>
                    {listTime(conv.lastMessageAt)}
                  </span>
                </span>
                {conv.context && conv.contextType && (
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                    <span className="font-medium">{ctxLabel[conv.contextType]}</span> · {conv.context}
                  </span>
                )}
                <span className="mt-0.5 flex items-center gap-2">
                  <span className={`min-w-0 flex-1 truncate text-xs ${conv.hasUnread ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                    {conv.lastMessage ? (
                      <>
                        {conv.lastMessageFromMe && <span className="text-muted-foreground">{t("you")}: </span>}
                        {conv.lastMessage}
                      </>
                    ) : (
                      <span className="italic">{t("noMessages")}</span>
                    )}
                  </span>
                  {conv.hasUnread && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label={t("inbox")} />}
                </span>
              </span>
            </Link>

            {showActions && (
              <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <ChatActions conversationId={conv.id} status={conv.participantStatus} compact />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
