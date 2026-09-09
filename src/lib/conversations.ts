import { prisma } from "@/lib/prisma";
import { getProfileTitle } from "@/lib/user-name";
import { getBlockedUserIds } from "@/lib/blocking";
import type { ConversationPreview } from "@/lib/conversation-types";

// Eén bron voor de conversatie-lijst (berichten-index, conversation-page en
// het polling-endpoint /api/conversations gebruikten elk een eigen kopie met
// kleine verschillen — o.a. de blokkeer-filter die alleen op de index zat).

type Options = {
  /** Het gesprek dat nu open staat telt nooit als ongelezen (wordt net gelezen). */
  activeConversationId?: string | null;
  take?: number;
};

export async function getConversationPreviews(
  userId: string,
  { activeConversationId = null, take = 200 }: Options = {},
): Promise<ConversationPreview[]> {
  // Fase 7: gesprekken met geblokkeerde gebruikers (symmetrisch) verbergen.
  const blockedIds = await getBlockedUserIds(userId);

  const conversations = await prisma.conversation.findMany({
    where: {
      participants: { some: { userId } },
      ...(blockedIds.size > 0
        ? { NOT: { participants: { some: { userId: { in: Array.from(blockedIds) } } } } }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take,
    include: {
      participants: {
        include: { user: { select: { id: true, displayName: true, firstName: true, lastName: true, accountKind: true, companyName: true, avatarUrl: true } } },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, imageUrl: true, createdAt: true, senderId: true },
      },
      auction: { select: { title: true } },
      claimsale: { select: { title: true } },
      listing: { select: { title: true } },
    },
  });

  return conversations.map((conv) => {
    const me = conv.participants.find((p) => p.userId === userId);
    const other = conv.participants.find((p) => p.userId !== userId);
    const last = conv.messages[0];
    const lastRead = me?.lastReadAt;
    const hasUnread =
      conv.id === activeConversationId
        ? false
        : !!(last && last.senderId !== userId && (!lastRead || last.createdAt > lastRead));

    const context = conv.auction?.title ?? conv.claimsale?.title ?? conv.listing?.title ?? null;
    const contextType = conv.auction
      ? ("auction" as const)
      : conv.claimsale
        ? ("claimsale" as const)
        : conv.listing
          ? ("listing" as const)
          : null;

    const name = other ? getProfileTitle(other.user) : "";
    return {
      id: conv.id,
      otherUserId: other?.userId ?? null,
      otherUserName: name,
      otherUserInitial: (name || "?").charAt(0).toUpperCase(),
      otherUserAvatar: other?.user.avatarUrl ?? null,
      lastMessage: last ? last.body || (last.imageUrl ? "📷" : null) : null,
      lastMessageAt: last ? last.createdAt.toISOString() : null,
      lastMessageFromMe: !!last && last.senderId === userId,
      context,
      contextType,
      hasUnread,
      participantStatus: me?.status ?? "ACTIVE",
    };
  });
}
