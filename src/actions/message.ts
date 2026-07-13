"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publish, userChannel } from "@/lib/realtime";

export async function startConversation(recipientId: string, auctionId?: string, claimsaleId?: string, listingId?: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  if (session.user.id === recipientId) return { error: "Je kunt geen bericht naar jezelf sturen" };

  // Fase 43 — chatten vereist een bevestigd e-mailadres (anti-spam vanaf
  // wegwerp-accounts). Vroege gate: voorkomt dat iemand in een lege chat
  // belandt waar hij niets kan sturen. Dekt ook contactSeller.
  const { requireEmailVerified } = await import("@/lib/email-verification");
  const verified = await requireEmailVerified(session.user.id);
  if ("error" in verified) return { error: verified.error };

  // Check for existing conversation between these users for this context
  const existing = await prisma.conversation.findFirst({
    where: {
      auctionId: auctionId ?? null,
      claimsaleId: claimsaleId ?? null,
      listingId: listingId ?? null,
      participants: {
        every: { userId: { in: [session.user.id, recipientId] } },
      },
    },
    include: { participants: true },
  });

  if (existing && existing.participants.length === 2) {
    // Reactivate participant if they archived/deleted this conversation
    const myParticipant = existing.participants.find((p) => p.userId === session.user!.id);
    if (myParticipant && myParticipant.status !== "ACTIVE") {
      await prisma.conversationParticipant.update({
        where: { id: myParticipant.id },
        data: { status: "ACTIVE", archivedAt: null, deletedAt: null },
      });
    }
    return { conversationId: existing.id };
  }

  const conversation = await prisma.conversation.create({
    data: {
      auctionId,
      claimsaleId,
      listingId,
      participants: {
        create: [
          { userId: session.user.id },
          { userId: recipientId },
        ],
      },
    },
  });

  return { conversationId: conversation.id };
}

export async function sendMessage(conversationId: string, body: string, imageUrl?: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  if (!body.trim() && !imageUrl) return { error: "Bericht mag niet leeg zijn" };

  const { requireNotSuspended } = await import("@/lib/suspension");
  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

  // Fase 43 — chatten vereist een bevestigd e-mailadres.
  const { requireEmailVerified } = await import("@/lib/email-verification");
  const verified = await requireEmailVerified(session.user.id);
  if ("error" in verified) return { error: verified.error };

  // Verify user is participant
  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: session.user.id },
  });
  if (!participant) return { error: "Niet geautoriseerd" };

  // Fase 7: block sending to a user that's blocked either way.
  const otherParticipants = await prisma.conversationParticipant.findMany({
    where: { conversationId, userId: { not: session.user.id } },
    select: { userId: true },
  });
  if (otherParticipants.length > 0) {
    const otherIds = otherParticipants.map((p) => p.userId);
    const blockedRow = await prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: session.user.id, blockedId: { in: otherIds } },
          { blockedId: session.user.id, blockerId: { in: otherIds } },
        ],
      },
    });
    if (blockedRow) {
      return { error: "Je kunt deze gebruiker geen berichten sturen." };
    }
  }

  await prisma.message.create({
    data: {
      conversationId,
      senderId: session.user.id,
      body: body.trim(),
      imageUrl: imageUrl || null,
    },
  });

  // Update conversation timestamp
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  // Mark as read for sender
  await prisma.conversationParticipant.update({
    where: { id: participant.id },
    data: { lastReadAt: new Date() },
  });

  // Real-time new-message event naar alle andere participants (Fase 30A)
  if (otherParticipants.length > 0) {
    const sender = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { displayName: true },
    });
    const senderName = sender?.displayName ?? "Iemand";
    const preview = imageUrl && !body.trim() ? "📷 Foto" : body.trim().slice(0, 80);

    for (const op of otherParticipants) {
      const unreadConversationCount = await getUnreadConversationCountFor(op.userId);
      publish(userChannel(op.userId), {
        type: "new-message",
        payload: { conversationId, senderName, preview, unreadConversationCount },
      });
    }
  }

  return { success: true };
}

/**
 * Centrale helper om new-message-events te publishen na het direct
 * aanmaken van een Message-row buiten sendMessage (bv. proposal/bundle-
 * offer/pickup-flows die system-messages creëren). Roept publish aan
 * voor elke participant behalve de afzender, met een verse unread-count.
 */
export async function publishNewMessageForConversation(
  conversationId: string,
  senderId: string,
  preview: string,
) {
  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { displayName: true },
  });
  const senderName = sender?.displayName ?? "Iemand";

  const others = await prisma.conversationParticipant.findMany({
    where: { conversationId, userId: { not: senderId } },
    select: { userId: true },
  });

  for (const op of others) {
    const unreadConversationCount = await getUnreadConversationCountFor(op.userId);
    publish(userChannel(op.userId), {
      type: "new-message",
      payload: { conversationId, senderName, preview, unreadConversationCount },
    });
  }
}

// Helper: hoeveel conversaties hebben unread berichten voor deze user.
// Telt elke conversatie max 1 keer (niet per bericht) — match wat het
// message-icon in de header laat zien.
async function getUnreadConversationCountFor(userId: string): Promise<number> {
  const participations = await prisma.conversationParticipant.findMany({
    where: { userId, status: { not: "DELETED" } },
    select: { conversationId: true, lastReadAt: true },
  });
  if (participations.length === 0) return 0;

  let unreadCount = 0;
  for (const p of participations) {
    const hasUnread = await prisma.message.findFirst({
      where: {
        conversationId: p.conversationId,
        senderId: { not: userId },
        ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
      },
      select: { id: true },
    });
    if (hasUnread) unreadCount++;
  }
  return unreadCount;
}

export async function getUnreadConversationCount(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) return 0;
  return getUnreadConversationCountFor(session.user.id);
}

/**
 * Recente conversaties voor de message-icon popover. Returnt per conversatie:
 * laatste-bericht-preview, andere-deelnemer naam, unread-flag.
 */
export async function getRecentConversations(limit = 5) {
  const session = await auth();
  if (!session?.user?.id) return [];
  const userId = session.user.id;

  const participations = await prisma.conversationParticipant.findMany({
    where: { userId, status: { not: "DELETED" } },
    orderBy: { conversation: { updatedAt: "desc" } },
    take: limit,
    select: {
      lastReadAt: true,
      conversation: {
        select: {
          id: true,
          updatedAt: true,
          participants: {
            where: { userId: { not: userId } },
            select: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { body: true, imageUrl: true, senderId: true, createdAt: true },
          },
        },
      },
    },
  });

  return participations.map((p) => {
    const conv = p.conversation;
    const lastMsg = conv.messages[0];
    const other = conv.participants[0]?.user;
    const hasUnread =
      !!lastMsg &&
      lastMsg.senderId !== userId &&
      (!p.lastReadAt || lastMsg.createdAt > p.lastReadAt);
    return {
      conversationId: conv.id,
      otherUserName: other?.displayName ?? "Onbekend",
      otherUserImage: other?.avatarUrl ?? null,
      preview: lastMsg?.imageUrl && !lastMsg.body ? "📷 Foto" : (lastMsg?.body ?? "").slice(0, 80),
      lastMessageAt: lastMsg?.createdAt ?? conv.updatedAt,
      hasUnread,
    };
  });
}

export async function archiveConversation(conversationId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: session.user.id },
  });
  if (!participant) return { error: "Niet geautoriseerd" };

  await prisma.conversationParticipant.update({
    where: { id: participant.id },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });

  return { success: true };
}

export async function deleteConversation(conversationId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: session.user.id },
  });
  if (!participant) return { error: "Niet geautoriseerd" };

  await prisma.conversationParticipant.update({
    where: { id: participant.id },
    data: { status: "DELETED", deletedAt: new Date() },
  });

  return { success: true };
}

export async function restoreConversation(conversationId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: session.user.id },
  });
  if (!participant) return { error: "Niet geautoriseerd" };

  await prisma.conversationParticipant.update({
    where: { id: participant.id },
    data: { status: "ACTIVE", archivedAt: null, deletedAt: null },
  });

  return { success: true };
}

export async function contactSeller(sellerId: string, auctionId?: string, claimsaleId?: string, listingId?: string) {
  const result = await startConversation(sellerId, auctionId, claimsaleId, listingId);
  if (result.error) return result;
  return { conversationId: result.conversationId };
}
