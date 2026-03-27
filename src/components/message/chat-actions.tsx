"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Archive, Trash2, RotateCcw } from "lucide-react";
import { archiveConversation, deleteConversation, restoreConversation } from "@/actions/message";
import { useState } from "react";

interface ChatActionsProps {
  conversationId: string;
  status: string;
  compact?: boolean;
}

export function ChatActions({ conversationId, status, compact }: ChatActionsProps) {
  const t = useTranslations("chat");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAction(action: "archive" | "delete" | "restore") {
    setLoading(true);
    let result;
    if (action === "archive") result = await archiveConversation(conversationId);
    else if (action === "delete") result = await deleteConversation(conversationId);
    else result = await restoreConversation(conversationId);

    if (result?.success) {
      router.refresh();
    }
    setLoading(false);
  }

  const buttonClass = compact
    ? "rounded-lg p-1.5 transition-colors hover:bg-muted disabled:opacity-50"
    : "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50 text-muted-foreground";

  return (
    <div className="flex items-center gap-1">
      {status === "ACTIVE" && (
        <>
          <button
            onClick={() => handleAction("archive")}
            disabled={loading}
            className={buttonClass}
            title={t("archive")}
          >
            <Archive className="h-4 w-4 text-muted-foreground" />
            {!compact && t("archive")}
          </button>
          <button
            onClick={() => handleAction("delete")}
            disabled={loading}
            className={buttonClass}
            title={t("delete")}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
            {!compact && t("delete")}
          </button>
        </>
      )}

      {(status === "ARCHIVED" || status === "DELETED") && (
        <button
          onClick={() => handleAction("restore")}
          disabled={loading}
          className={buttonClass}
          title={t("restore")}
        >
          <RotateCcw className="h-4 w-4 text-muted-foreground" />
          {!compact && t("restore")}
        </button>
      )}

      {status === "ARCHIVED" && (
        <button
          onClick={() => handleAction("delete")}
          disabled={loading}
          className={buttonClass}
          title={t("delete")}
        >
          <Trash2 className="h-4 w-4 text-red-500" />
          {!compact && t("delete")}
        </button>
      )}
    </div>
  );
}
