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

  const [stats, activity] = await Promise.all([
    getSellerStats(session.user.id!),
    fetchActiveActivity(session.user.id!),
  ]);
  const xp = stats?.xp ?? 0;
  const currentLevel = getLevel(xp);
  const nextLevel = getNextLevel(xp);
  const progress = getLevelProgress(xp);

  return (
    // Twee kolommen zoals de fintech-referentie: sidebar-kolom met eigen
    // achtergrond (bg-card + rechterrand, strekt mee over de volle hoogte),
    // content rechts op bg-background. Max 1880px zoals de rest van de site.
    <div className="mx-auto flex w-full max-w-[1880px] flex-col md:flex-row">
      <RealtimePageRefresh events={["suspension-changed"]} />
      <aside className="w-full shrink-0 border-border bg-card px-4 py-4 md:w-[260px] md:border-r md:py-6">
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
        />
      </aside>
      <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:py-8 lg:px-8">
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
  );
}
