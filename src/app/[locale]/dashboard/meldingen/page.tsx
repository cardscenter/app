import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Bell, Settings } from "lucide-react";
import { NotificationList } from "@/components/ui/notification-list";
import { Pagination } from "@/components/ui/pagination";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { buttonVariants } from "@/components/ui/button-variants";

const PAGE_SIZE = 25;

export default async function MeldingenPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  const { page: pageParam } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const t = await getTranslations("notifications");

  const totalCount = await prisma.notification.count({
    where: { userId: session.user.id },
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const page = Math.min(Math.max(1, parseInt(pageParam ?? "1", 10) || 1), totalPages);

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return (
    <div className="space-y-6">
      {/* E-mailvoorkeuren leven sinds Fase 44 op /dashboard/instellingen —
          deze pagina is puur de notificatie-lijst. */}
      <DashboardPageHeader
        title={t("title")}
        subtitle={totalCount > 0 ? `${totalCount} melding${totalCount === 1 ? "" : "en"} — klik voor uitleg en details` : undefined}
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
        <>
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
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            baseUrl="/dashboard/meldingen"
            locale={locale}
          />
        </>
      )}
    </div>
  );
}
