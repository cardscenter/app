import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ChatLayout, type ConversationPreview } from "@/components/message/chat-layout";
import { getBlockedUserIds } from "@/lib/blocking";

export default async function MessagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);

  // Fase 7: filter conversations with blocked users (symmetric).
  const blockedIds = await getBlockedUserIds(session.user.id);

  const conversations = await prisma.conversation.findMany({
    where: {
      participants: { some: { userId: session.user.id! } },
      // Exclude conversations where ANY participant is in the blocked set.
      ...(blockedIds.size > 0
        ? {
            NOT: {
              participants: {
                some: { userId: { in: Array.from(blockedIds) } },
              },
            },
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      participants: {
        include: { user: { select: { id: true, displayName: true } } },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      auction: { select: { title: true } },
      claimsale: { select: { title: true } },
      listing: { select: { title: true } },
    },
  });

  const previews: ConversationPreview[] = conversations.map((conv) => {
    const myParticipant = conv.participants.find((p) => p.userId === session.user!.id);
    const otherUser = conv.participants.find((p) => p.userId !== session.user!.id);
    const lastMessage = conv.messages[0];
    const lastRead = myParticipant?.lastReadAt;
    const hasUnread = !!(lastMessage && (!lastRead || new Date(lastMessage.createdAt) > new Date(lastRead)));

    const context = conv.auction?.title ?? conv.claimsale?.title ?? conv.listing?.title ?? null;
    const contextType = conv.auction ? "auction" as const : conv.claimsale ? "claimsale" as const : conv.listing ? "listing" as const : null;

    return {
      id: conv.id,
      otherUserName: otherUser?.user.displayName ?? "Gebruiker",
      otherUserInitial: (otherUser?.user.displayName ?? "?").charAt(0).toUpperCase(),
      lastMessage: lastMessage?.body ?? null,
      lastMessageDate: lastMessage
        ? new Date(lastMessage.createdAt).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })
        : null,
      context,
      contextType,
      hasUnread,
      participantStatus: myParticipant?.status ?? "ACTIVE",
    };
  });

  return (
    <ChatLayout conversations={previews}>
      {/* No active conversation selected */}
      <div />
    </ChatLayout>
  );
}
