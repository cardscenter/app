import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { getSellerStats } from "@/actions/review";
import { fetchActiveActivity } from "@/lib/dashboard-queries";
import { getLevel, getNextLevel, getLevelProgress } from "@/lib/seller-levels";
import { isUserSuspended } from "@/lib/suspension";
import { SuspensionBanner } from "@/components/dashboard/suspension-banner";
import { EmailVerificationBanner } from "@/components/dashboard/email-verification-banner";
import { PageContainer } from "@/components/layout/page-container";
import { RealtimePageRefresh } from "@/components/providers/realtime-page-refresh";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id! },
    select: {
      accountType: true,
      suspendedUntil: true,
      suspensionType: true,
      suspensionReason: true,
      emailVerifiedAt: true,
    },
  });

  const suspended = user ? isUserSuspended(user) : false;

  const [stats, activity] = await Promise.all([
    getSellerStats(session.user.id!),
    fetchActiveActivity(session.user.id!),
  ]);
  const xp = stats?.xp ?? 0;
  const currentLevel = getLevel(xp);
  const nextLevel = getNextLevel(xp);
  const progress = getLevelProgress(xp);

  return (
    <PageContainer width="wide" className="py-8">
      <RealtimePageRefresh events={["suspension-changed"]} />
      <div className="flex flex-col gap-8 md:flex-row">
        <aside className="w-full md:w-64 shrink-0">
          <DashboardNav
            accountType={user?.accountType}
            level={{
              name: currentLevel.name,
              icon: currentLevel.icon,
              color: currentLevel.color,
              bgColor: currentLevel.bgColor,
              borderColor: currentLevel.borderColor,
              progress,
              nextLevelName: nextLevel?.name ?? null,
            }}
            counts={activity.counts}
          />
        </aside>
        <div className="flex-1 min-w-0">
          {suspended && user && (
            <SuspensionBanner
              type={user.suspensionType ?? "TEMPORARY"}
              until={user.suspendedUntil?.toISOString() ?? null}
              reason={user.suspensionReason}
            />
          )}
          {user && !user.emailVerifiedAt && <EmailVerificationBanner />}
          {children}
        </div>
      </div>
    </PageContainer>
  );
}
