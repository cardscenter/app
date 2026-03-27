"use client";

import { sendMessage } from "@/actions/message";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Message = {
  id: string;
  body: string;
  senderName: string;
  senderId: string;
  createdAt: string;
};

export function MessageThread({
  conversationId,
  messages,
  currentUserId,
}: {
  conversationId: string;
  messages: Message[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSend(formData: FormData) {
    setLoading(true);
    const body = formData.get("body") as string;
    await sendMessage(conversationId, body);
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="flex flex-col">
      {/* Messages */}
      <div className="space-y-4 mb-6">
        {messages.length === 0 ? (
          <p className="text-sm text-zinc-500">Nog geen berichten</p>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.senderId === currentUserId;
            return (
              <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[70%] rounded-lg px-4 py-2 ${
                  isOwn
                    ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                }`}>
                  <p className="text-xs font-medium opacity-70 mb-1">{msg.senderName}</p>
                  <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                  <p className="text-xs opacity-50 mt-1">
                    {new Date(msg.createdAt).toLocaleString("nl-NL")}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Send form */}
      <form action={handleSend} className="flex gap-2">
        <input
          name="body"
          type="text"
          placeholder="Typ een bericht..."
          required
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Verstuur
        </button>
      </form>
    </div>
  );
}
