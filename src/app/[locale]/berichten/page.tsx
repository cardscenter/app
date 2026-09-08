import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getConversationPreviews } from "@/lib/conversations";
import { ChatLayout } from "@/components/message/chat-layout";
import { MessagesFrame } from "@/components/message/messages-frame";

export default async function MessagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const previews = await getConversationPreviews(session.user.id);

  return (
    <MessagesFrame>
      <ChatLayout conversations={previews}>
        {/* Geen actief gesprek */}
        <div />
      </ChatLayout>
    </MessagesFrame>
  );
}
