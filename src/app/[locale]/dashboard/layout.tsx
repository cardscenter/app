import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { getSellerStats } from "@/actions/review";
import { getLevel, getNextLevel, getLevelProgress } from "@/lib/seller-levels";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id! },
    select: { accountType: true },
  });

  const stats = await getSellerStats(session.user.id!);
  const xp = stats?.xp ?? 0;
  const currentLevel = getLevel(xp);
  const nextLevel = getNextLevel(xp);
  const progress = getLevelProgress(xp);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
          />
        </aside>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
