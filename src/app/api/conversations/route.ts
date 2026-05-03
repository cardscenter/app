import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Polling-endpoint voor de conversation-lijst in de linker kolom (Fase 27.57).
// Returnt dezelfde shape als ConversationPreview in chat-layout zodat de
// client direct kan vervangen. Lichter dan de full page-fetch want geen
// message-bodies, alleen last-message metadata.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const userId = session.user.id;
  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId } } },
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: {
      participants: {
        include: { user: { select: { id: true, displayName: true } } },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, createdAt: true, senderId: true },
      },
      auction: { select: { title: true } },
      claimsale: { select: { title: true } },
      listing: { select: { title: true } },
    },
  });

  const previews = conversations.map((conv) => {
    const myP = conv.participants.find((p) => p.userId === userId);
    const otherUser = conv.participants.find((p) => p.userId !== userId);
    const lastMsg = conv.messages[0];
    const lastRead = myP?.lastReadAt;
    const hasUnread = !!(lastMsg && lastMsg.senderId !== userId && (!lastRead || new Date(lastMsg.createdAt) > new Date(lastRead)));

    const context = conv.auction?.title ?? conv.claimsale?.title ?? conv.listing?.title ?? null;
    const contextType = conv.auction
      ? ("auction" as const)
      : conv.claimsale
        ? ("claimsale" as const)
        : conv.listing
          ? ("listing" as const)
          : null;

    return {
      id: conv.id,
      otherUserName: otherUser?.user.displayName ?? "Gebruiker",
      otherUserInitial: (otherUser?.user.displayName ?? "?").charAt(0).toUpperCase(),
      lastMessage: lastMsg?.body ?? null,
      lastMessageDate: lastMsg
        ? new Date(lastMsg.createdAt).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })
        : null,
      context,
      contextType,
      hasUnread,
      participantStatus: myP?.status ?? "ACTIVE",
    };
  });

  return NextResponse.json({ conversations: previews });
}
