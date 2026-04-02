import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/cron/cleanup-archived-chats
// Call this daily to permanently delete conversations archived for 60+ days
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  // Find participants archived before cutoff
  const staleParticipants = await prisma.conversationParticipant.findMany({
    where: {
      status: "ARCHIVED",
      archivedAt: { lt: cutoff },
    },
    select: { id: true, conversationId: true },
  });

  if (staleParticipants.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  // Delete the stale participants
  const deleted = await prisma.conversationParticipant.deleteMany({
    where: { id: { in: staleParticipants.map((p) => p.id) } },
  });

  // Check if any conversations now have zero participants → fully delete them
  const convoIds = [...new Set(staleParticipants.map((p) => p.conversationId))];
  let conversationsDeleted = 0;

  for (const convoId of convoIds) {
    const remaining = await prisma.conversationParticipant.count({
      where: { conversationId: convoId },
    });

    if (remaining === 0) {
      // No participants left — delete messages, proposals, and conversation
      await prisma.message.deleteMany({ where: { conversationId: convoId } });
      await prisma.proposal.deleteMany({ where: { conversationId: convoId } });
      await prisma.conversation.delete({ where: { id: convoId } });
      conversationsDeleted++;
    }
  }

  return NextResponse.json({
    participantsRemoved: deleted.count,
    conversationsDeleted,
  });
}
