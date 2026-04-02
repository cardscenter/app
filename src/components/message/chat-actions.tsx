"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Archive, RotateCcw } from "lucide-react";
import { archiveConversation, restoreConversation } from "@/actions/message";
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

  async function handleAction(action: "archive" | "restore") {
    setLoading(true);
    const result = action === "archive"
      ? await archiveConversation(conversationId)
      : await restoreConversation(conversationId);

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
        <button
          onClick={() => handleAction("archive")}
          disabled={loading}
          className={buttonClass}
          title={t("archive")}
        >
          <Archive className="h-4 w-4 text-muted-foreground" />
          {!compact && t("archive")}
        </button>
      )}

      {status === "ARCHIVED" && (
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
    </div>
  );
}
