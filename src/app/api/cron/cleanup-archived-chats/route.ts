import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCronLogging } from "@/lib/cron-logging";
import { resolveCronTrigger } from "@/lib/cron-auth";

// GET /api/cron/cleanup-archived-chats
// Call this daily to permanently delete conversations archived for 60+ days
export async function GET(request: Request) {
  const trigger = await resolveCronTrigger(request);
  if (!trigger) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await withCronLogging("cleanup-archived-chats", async (run) => {
    const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const staleParticipants = await prisma.conversationParticipant.findMany({
      where: {
        status: "ARCHIVED",
        archivedAt: { lt: cutoff },
      },
      select: { id: true, conversationId: true },
    });

    if (staleParticipants.length === 0) {
      return { participantsRemoved: 0, conversationsDeleted: 0 };
    }

    const deleted = await prisma.conversationParticipant.deleteMany({
      where: { id: { in: staleParticipants.map((p) => p.id) } },
    });

    const convoIds = [...new Set(staleParticipants.map((p) => p.conversationId))];
    let conversationsDeleted = 0;

    for (const convoId of convoIds) {
      const remaining = await prisma.conversationParticipant.count({
        where: { conversationId: convoId },
      });

      if (remaining === 0) {
        await prisma.message.deleteMany({ where: { conversationId: convoId } });
        await prisma.proposal.deleteMany({ where: { conversationId: convoId } });
        await prisma.conversation.delete({ where: { id: convoId } });
        conversationsDeleted++;
      }
    }

    run.setItemsProcessed(deleted.count + conversationsDeleted);
    return { participantsRemoved: deleted.count, conversationsDeleted };
  }, trigger);

  return NextResponse.json(result);
}
