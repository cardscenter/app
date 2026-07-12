/**
 * Chat-ongelezen-mails (Fase 16). Mailt ontvangers van een chatbericht dat na
 * CHAT_UNREAD_EMAIL_DELAY_MINUTES nog ongelezen is — wie actief op de site
 * chat, krijgt géén mail.
 *
 * Read-state zit op ConversationParticipant.lastReadAt (geen per-message
 * vlag): een bericht is ongelezen als createdAt > lastReadAt (of null) en
 * senderId != participant.userId.
 *
 * Episode-dedupe: max één mail per ongelezen-episode per conversatie — er
 * gaat pas een nieuwe mail uit nadat de ontvanger de chat weer gelezen heeft
 * (EmailLog.sentAt > lastReadAt betekent "al gemaild voor deze episode").
 */

import "server-only";

import { prisma } from "@/lib/prisma";
import { sendChatUnreadEmail } from "@/lib/email/notification-email";
import {
  CHAT_UNREAD_EMAIL_DELAY_MINUTES,
  EMAIL_LOG_RETENTION_DAYS,
} from "@/lib/email/preferences-config";

/** Alleen berichten uit dit venster meenemen — oude historie is al gemaild of irrelevant. */
const LOOKBACK_DAYS = 7;

function previewOf(body: string, imageUrl: string | null): string {
  const trimmed = body.trim();
  if (!trimmed && imageUrl) return "📷 Foto";
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
}

export async function sendUnreadChatEmails(): Promise<{
  emailsSent: number;
  candidates: number;
  logsPruned: number;
}> {
  const now = Date.now();
  const cutoff = new Date(now - CHAT_UNREAD_EMAIL_DELAY_MINUTES * 60 * 1000);
  const lookback = new Date(now - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  // Recente berichten die oud genoeg zijn om te mailen, per conversatie.
  const messages = await prisma.message.findMany({
    where: { createdAt: { lt: cutoff, gte: lookback } },
    orderBy: { createdAt: "desc" },
    take: 2000,
    select: {
      conversationId: true,
      senderId: true,
      createdAt: true,
      body: true,
      imageUrl: true,
      sender: { select: { displayName: true } },
    },
  });
  if (messages.length === 0) {
    const logsPruned = await pruneOldLogs();
    return { emailsSent: 0, candidates: 0, logsPruned };
  }

  const conversationIds = [...new Set(messages.map((m) => m.conversationId))];
  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId: { in: conversationIds }, status: "ACTIVE" },
    select: { userId: true, conversationId: true, lastReadAt: true },
  });

  let emailsSent = 0;
  let candidates = 0;

  for (const p of participants) {
    // Nieuwste ongelezen bericht van de ander in deze conversatie.
    const unread = messages.find(
      (m) =>
        m.conversationId === p.conversationId &&
        m.senderId !== p.userId &&
        (!p.lastReadAt || m.createdAt > p.lastReadAt),
    );
    if (!unread) continue;
    candidates++;

    // Episode-dedupe: al gemaild sinds de laatste keer lezen? Dan stil blijven.
    const dedupeKey = `chat:${p.conversationId}:${p.userId}`;
    const alreadyMailed = await prisma.emailLog.findFirst({
      where: { dedupeKey, sentAt: { gt: p.lastReadAt ?? new Date(0) } },
      select: { id: true },
    });
    if (alreadyMailed) continue;

    const sent = await sendChatUnreadEmail({
      userId: p.userId,
      senderName: unread.sender.displayName,
      preview: previewOf(unread.body, unread.imageUrl),
      conversationId: p.conversationId,
    });
    if (sent) emailsSent++;
  }

  const logsPruned = await pruneOldLogs();
  return { emailsSent, candidates, logsPruned };
}

async function pruneOldLogs(): Promise<number> {
  const cutoff = new Date(Date.now() - EMAIL_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const r = await prisma.emailLog.deleteMany({ where: { sentAt: { lt: cutoff } } });
  return r.count;
}
