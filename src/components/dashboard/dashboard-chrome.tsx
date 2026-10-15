import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProfileTitle } from "@/lib/user-name";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getSellerStats } from "@/actions/review";
import { fetchActiveActivity } from "@/lib/dashboard-queries";
import { getUnreadConversationCountFor, getUnreadNotificationCountFor } from "@/lib/unread-counts";
import { getAdminQueueCounts } from "@/lib/admin-queue-counts";
import { getLevel, getNextLevel, getLevelProgress } from "@/lib/seller-levels";
import { getFeatureSnapshot } from "@/lib/feature-flags";
import { isUserSuspended } from "@/lib/suspension";
import { SuspensionBanner } from "@/components/dashboard/suspension-banner";
import { EmailVerificationBanner } from "@/components/dashboard/email-verification-banner";
import { RealtimePageRefresh } from "@/components/providers/realtime-page-refresh";

// Het volledige dashboard-frame (auth-guard, navy sidebar met live counts,
// banners) als herbruikbaar server-component. Gebruikt door de dashboard-
// layout én de berichten-layout, zodat /berichten in dezelfde shell leeft
// (Support-groep in de sidebar) zonder de data-fetch te dupliceren.

export async function DashboardChrome({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id! },
    select: {
      accountType: true,
      role: true,
      suspendedUntil: true,
      suspensionType: true,
      suspensionReason: true,
      emailVerifiedAt: true,
      displayName: true,
      firstName: true,
      lastName: true,
      accountKind: true,
      companyName: true,
      email: true,
      avatarUrl: true,
    },
  });

  const suspended = user ? isUserSuspended(user) : false;

  const [stats, activity, unreadMessages, unreadNotifications, adminCounts] = await Promise.all([
    getSellerStats(session.user.id!),
    fetchActiveActivity(session.user.id!),
    getUnreadConversationCountFor(session.user.id!),
    getUnreadNotificationCountFor(session.user.id!),
    // Sidebar-badges van het admin-panel (zelfde bron als de KPI-tegels).
    user?.accountType === "ADMIN" ? getAdminQueueCounts() : Promise.resolve(undefined),
  ]);
  const features = getFeatureSnapshot(user?.accountType);
  const xp = stats?.xp ?? 0;
  const currentLevel = getLevel(xp);
  const nextLevel = getNextLevel(xp);
  const progress = getLevelProgress(xp);

  return (
    <DashboardShell
      nav={
        <DashboardNav
          accountType={user?.accountType}
          role={user?.role}
          user={
            user
              ? { name: getProfileTitle(user), handle: user.displayName, email: user.email, image: user.avatarUrl }
              : undefined
          }
          level={
            // Rang/XP is geparkeerd (FEATURE_XP, ook voor admins uit): dan geen
            // voortgangsbalk in de gebruikerskaart.
            features.FEATURE_XP
              ? {
                  name: currentLevel.name,
                  icon: currentLevel.icon,
                  color: currentLevel.color,
                  bgColor: currentLevel.bgColor,
                  borderColor: currentLevel.borderColor,
                  progress,
                  nextLevelName: nextLevel?.name ?? null,
                }
              : undefined
          }
          counts={activity.counts}
          unread={{ messages: unreadMessages, notifications: unreadNotifications }}
          adminPendingCounts={adminCounts}
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
