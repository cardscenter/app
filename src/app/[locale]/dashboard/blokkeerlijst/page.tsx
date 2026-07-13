import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { BlockedListContent } from "@/components/dashboard/blocked-list-content";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";

export default async function BlockedListPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);
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
      <DashboardPageHeader
        title={t("blockedListTitle")}
        backHref="/dashboard/instellingen"
        backLabel="Terug naar instellingen"
      />

      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
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
