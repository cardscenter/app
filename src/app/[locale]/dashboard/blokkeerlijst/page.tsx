import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { BlockedListContent } from "@/components/dashboard/blocked-list-content";

export default async function BlockedListPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const t = await getTranslations("blockReport");

  const rows = await prisma.userBlock.findMany({
    where: { blockerId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      blocked: { select: { id: true, displayName: true, avatarUrl: true } },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t("blockedListTitle")}</h1>

      <div className="glass rounded-xl p-6">
        <BlockedListContent
          rows={rows.map((r) => ({
            id: r.id,
            blockedId: r.blocked.id,
            displayName: r.blocked.displayName,
            avatarUrl: r.blocked.avatarUrl,
            reason: r.reason,
            createdAt: r.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
