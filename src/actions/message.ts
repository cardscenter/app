"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function startConversation(recipientId: string, auctionId?: string, claimsaleId?: string, listingId?: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  if (session.user.id === recipientId) return { error: "Je kunt geen bericht naar jezelf sturen" };

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

  return { success: true };
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
