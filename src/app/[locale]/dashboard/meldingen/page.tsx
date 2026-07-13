import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Bell, Settings } from "lucide-react";
import { NotificationList } from "@/components/ui/notification-list";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { buttonVariants } from "@/components/ui/button-variants";

export default async function MeldingenPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const t = await getTranslations("notifications");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      {/* E-mailvoorkeuren leven sinds Fase 44 op /dashboard/instellingen —
          deze pagina is puur de notificatie-lijst. */}
      <DashboardPageHeader
        title={t("title")}
        action={
          <Link href="/dashboard/instellingen" className={buttonVariants({ variant: "outline" })}>
            <Settings className="h-4 w-4" />
            E-mailvoorkeuren beheren
          </Link>
        }
      />

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title={t("empty")} />
      ) : (
        <NotificationList
          notifications={notifications.map((n) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            body: n.body,
            link: n.link,
            read: n.read,
            createdAt: n.createdAt.toISOString(),
          }))}
        />
      )}
    </div>
  );
}
