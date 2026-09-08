import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getSellerStats } from "@/actions/review";
import { fetchActiveActivity } from "@/lib/dashboard-queries";
import { getUnreadConversationCountFor, getUnreadNotificationCountFor } from "@/lib/unread-counts";
import { getLevel, getNextLevel, getLevelProgress } from "@/lib/seller-levels";
import { isUserSuspended } from "@/lib/suspension";
import { SuspensionBanner } from "@/components/dashboard/suspension-banner";
import { EmailVerificationBanner } from "@/components/dashboard/email-verification-banner";
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
      displayName: true,
      email: true,
      avatarUrl: true,
    },
  });

  const suspended = user ? isUserSuspended(user) : false;

  const [stats, activity, unreadMessages, unreadNotifications] = await Promise.all([
    getSellerStats(session.user.id!),
    fetchActiveActivity(session.user.id!),
    getUnreadConversationCountFor(session.user.id!),
    getUnreadNotificationCountFor(session.user.id!),
  ]);
  const xp = stats?.xp ?? 0;
  const currentLevel = getLevel(xp);
  const nextLevel = getNextLevel(xp);
  const progress = getLevelProgress(xp);

  return (
    // TailAdmin-stijl (sept 2026): DashboardShell rendert de donkere navy
    // sidebar (sticky kolom op md+, off-canvas drawer op mobiel) en de lichte
    // content-kolom. Max 1880px zoals de rest van de site.
    <DashboardShell
      nav={
        <DashboardNav
          accountType={user?.accountType}
          user={
            user
              ? { name: user.displayName, email: user.email, image: user.avatarUrl }
              : undefined
          }
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
          unread={{ messages: unreadMessages, notifications: unreadNotifications }}
        />
      }
    >
      <RealtimePageRefresh events={["suspension-changed"]} />
      {suspended && user && (
        <SuspensionBanner
          type={user.suspensionType ?? "TEMPORARY"}
          until={user.suspendedUntil?.toISOString() ?? null}
          reason={user.suspensionReason}
        />
      )}
      {user && !user.emailVerifiedAt && <EmailVerificationBanner />}
      {children}
    </DashboardShell>
  );
}
