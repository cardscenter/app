import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Trophy, Archive, Vault, Store, MessageSquare, Calendar, Sparkles, Lock, Check } from "lucide-react";
import { EmberIcon } from "@/components/customization/ember-icon";
import { checkAchievements, getUserAchievements, type AchievementCategory } from "@/lib/achievements";
import { cn } from "@/lib/utils";

const CATEGORY_META: Record<AchievementCategory, { icon: typeof Archive; label: string; color: string; bgColor: string }> = {
  ARCHIVE:   { icon: Archive,        label: "The Archive",        color: "text-amber-500",   bgColor: "bg-amber-500/10" },
  VAULT:     { icon: Vault,          label: "The Vault",          color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
  TRADER:    { icon: Store,          label: "Trader's Guild",     color: "text-blue-500",    bgColor: "bg-blue-500/10" },
  SOCIAL:    { icon: MessageSquare,  label: "Social",             color: "text-purple-500",  bgColor: "bg-purple-500/10" },
  MILESTONE: { icon: Calendar,       label: "Milestones",         color: "text-orange-500",  bgColor: "bg-orange-500/10" },
  FOUNDER:   { icon: Sparkles,       label: "Founders",           color: "text-pink-500",    bgColor: "bg-pink-500/10" },
};

const CATEGORY_ORDER: AchievementCategory[] = ["MILESTONE", "VAULT", "TRADER", "ARCHIVE", "SOCIAL", "FOUNDER"];

export default async function AchievementsPage() {
  const t = await getTranslations("customization");
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  // Recompute on visit so thresholds reached out-of-band (cron, etc.) unlock here.
  await checkAchievements(session.user.id);
  const achievements = await getUserAchievements(session.user.id);

  const unlocked = achievements.filter((a) => a.unlocked).length;
  const total = achievements.length;

  const grouped = new Map<AchievementCategory, typeof achievements>();
  for (const cat of CATEGORY_ORDER) grouped.set(cat, []);
  for (const a of achievements) {
    grouped.get(a.category as AchievementCategory)?.push(a);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/customization" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{t("achievementsTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("achievementsProgress", { unlocked, total })}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-2 ring-1 ring-amber-500/20">
          <Trophy className="size-5 text-amber-500" />
          <span className="font-bold text-amber-500">{unlocked} / {total}</span>
        </div>
      </div>

      <div className="space-y-8">
        {CATEGORY_ORDER.map((category) => {
          const items = grouped.get(category) ?? [];
          if (items.length === 0) return null;
          const meta = CATEGORY_META[category];
          const Icon = meta.icon;
          const categoryUnlocked = items.filter((a) => a.unlocked).length;

          return (
            <section key={category}>
              <div className="mb-4 flex items-center gap-3">
                <div className={cn("flex size-10 items-center justify-center rounded-xl", meta.bgColor, meta.color)}>
                  <Icon className="size-5" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold">{meta.label}</h2>
                  <p className="text-xs text-muted-foreground">
                    {categoryUnlocked} / {items.length} ontgrendeld
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((a) => {
                  const percent = Math.min(100, Math.round((a.progress / a.threshold) * 100));
                  return (
                    <div
                      key={a.key}
                      className={cn(
                        "glass rounded-2xl p-4 ring-1 transition-all",
                        a.unlocked
                          ? "ring-amber-500/40 bg-gradient-to-br from-amber-500/5 to-transparent"
                          : "ring-white/10"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{a.name}</p>
                            {a.unlocked ? (
                              <Check className="size-4 text-amber-500" />
                            ) : (
                              <Lock className="size-3.5 text-muted-foreground/50" />
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{a.description}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 text-right">
                          {a.rewardEmber ? (
                            <span className="flex items-center gap-1 text-xs font-bold text-orange-500">
                              <EmberIcon className="size-3" />
                              +{a.rewardEmber}
                            </span>
                          ) : null}
                          {a.rewardXP ? (
                            <span className="text-xs font-bold text-purple-500">+{a.rewardXP} XP</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 space-y-1">
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              a.unlocked ? "bg-amber-500" : "bg-primary/60"
                            )}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{a.progress.toLocaleString("nl-NL")} / {a.threshold.toLocaleString("nl-NL")}</span>
                          <span>{percent}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
