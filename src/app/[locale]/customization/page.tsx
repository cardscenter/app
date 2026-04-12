import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { Package, Backpack, Paintbrush, User, ChevronRight, Trophy } from "lucide-react";
import { EmberBalance } from "@/components/customization/ember-balance";
import { EmberIcon } from "@/components/customization/ember-icon";
import { LoginStreak } from "@/components/customization/login-streak";
import { getLoginStreakInfo } from "@/actions/customization";

export default async function CustomizationPage() {
  const t = await getTranslations("customization");
  const session = await auth();

  let emberBalance = 0;
  let ownedCount = 0;
  let streakInfo: Awaited<ReturnType<typeof getLoginStreakInfo>> = null;
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emberBalance: true },
    });
    emberBalance = user?.emberBalance ?? 0;
    ownedCount = await prisma.ownedItem.count({
      where: { userId: session.user.id },
    });
    streakInfo = await getLoginStreakInfo();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 shadow-2xl ring-1 ring-white/10">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-orange-500/10 via-transparent to-purple-500/10" />
        <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 size-64 rounded-full bg-purple-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">{t("title")}</h1>
            <p className="mt-1 text-slate-400">{t("subtitle")}</p>
          </div>

          {session?.user?.id && (
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center rounded-xl bg-white/5 px-5 py-3 ring-1 ring-white/10">
                <EmberBalance balance={emberBalance} size="xl" className="text-white" />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/customization/achievements"
          className="group glass rounded-2xl p-5 transition-all hover:ring-2 hover:ring-amber-500/30"
        >
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
            <Trophy className="size-6" />
          </div>
          <p className="font-semibold">{t("achievements")}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("achievementsSubtitle")}</p>
          <div className="mt-3 flex items-center gap-1 text-sm font-medium text-amber-500">
            {t("viewAchievements")}
            <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </Link>
        <Link
          href="/customization/packs"
          className="group glass rounded-2xl p-5 transition-all hover:ring-2 hover:ring-purple-500/30"
        >
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
            <Package className="size-6" />
          </div>
          <p className="font-semibold">{t("chapters")}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("chaptersSubtitle")}</p>
          <div className="mt-3 flex items-center gap-1 text-sm font-medium text-purple-500">
            {t("viewChapters")}
            <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </Link>
        <Link
          href="/customization/inventory"
          className="group glass rounded-2xl p-5 transition-all hover:ring-2 hover:ring-blue-500/30"
        >
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
            <Backpack className="size-6" />
          </div>
          <p className="font-semibold">{t("inventory")}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {ownedCount > 0 ? `${ownedCount} items` : t("noItems")}
          </p>
          <div className="mt-3 flex items-center gap-1 text-sm font-medium text-blue-500">
            {t("viewInventory")}
            <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </Link>
        <Link
          href="/customization/equip"
          className="group glass rounded-2xl p-5 transition-all hover:ring-2 hover:ring-emerald-500/30"
        >
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
            <Paintbrush className="size-6" />
          </div>
          <p className="font-semibold">{t("equipTitle")}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("equipSubtitle")}</p>
          <div className="mt-3 flex items-center gap-1 text-sm font-medium text-emerald-500">
            {t("equip")}
            <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </Link>
      </div>

      {session?.user?.id && streakInfo && (
        <div className="mb-10">
          <LoginStreak
            currentStreak={streakInfo.currentStreak}
            nextStreak={streakInfo.nextStreak}
            nextReward={streakInfo.nextReward}
            alreadyClaimed={streakInfo.alreadyClaimed}
            rewards={streakInfo.rewards}
          />
        </div>
      )}

      {session?.user?.id && (
        <Link
          href={`/verkoper/${session.user.id}`}
          className="mb-10 flex items-center gap-3 glass rounded-2xl p-4 transition-all hover:ring-2 hover:ring-primary/30"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <User className="size-5" />
          </div>
          <div className="flex-1">
            <p className="font-medium">{t("viewPublicProfile")}</p>
            <p className="text-sm text-muted-foreground">{t("viewPublicProfileDesc")}</p>
          </div>
          <ChevronRight className="size-5 text-muted-foreground" />
        </Link>
      )}

      <div className="glass rounded-2xl p-6">
        <h2 className="mb-1 text-lg font-bold">{t("earnEmber")}</h2>
        <p className="mb-5 text-sm text-muted-foreground">{t("earnEmberDesc")}</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Aankoop voltooien", ember: 15 },
            { label: "Verkoop voltooien", ember: 15 },
            { label: "Review geven", ember: 10 },
            { label: "Bod plaatsen", ember: 3 },
            { label: "Item listen", ember: 5 },
            { label: "Review ontvangen (4-5\u2605)", ember: 5 },
            { label: "Dagelijkse login", ember: "10-500" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-xl bg-muted/50 px-3.5 py-2.5">
              <span className="text-sm">{item.label}</span>
              <span className="flex items-center gap-1 text-sm font-bold text-orange-500">
                <EmberIcon className="size-3.5" />
                +{item.ember}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
