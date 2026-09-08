import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getConversationPreviews } from "@/lib/conversations";

// Polling-endpoint voor de conversation-lijst in de linker kolom (Fase 27.57).
// Zelfde bron (getConversationPreviews) als de berichten-pages zodat de
// client de lijst 1-op-1 kan vervangen. Lichter dan de full page-fetch want
// geen message-bodies, alleen last-message metadata.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const conversations = await getConversationPreviews(session.user.id);
  return NextResponse.json({ conversations });
}
