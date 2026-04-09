import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { SessionProvider } from "next-auth/react";
import { Link } from "@/i18n/navigation";
import { ExternalLink, Shield, ShieldCheck, Calendar, Mail, CreditCard, Award } from "lucide-react";
import { getLevel, SELLER_LEVELS } from "@/lib/seller-levels";
import { getSellerStats } from "@/actions/review";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { BannerSelector } from "@/components/dashboard/banner-selector";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const t = await getTranslations("dashboard");
  const tp = await getTranslations("profile");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      usernameHistory: {
        orderBy: { changedAt: "desc" },
        take: 5,
      },
    },
  });

  if (!user) return null;

  const stats = await getSellerStats(user.id);
  const sellerLevel = stats ? getLevel(stats.xp) : null;
  const currentLevelIndex = sellerLevel
    ? SELLER_LEVELS.findIndex((l) => l.nameKey === sellerLevel.nameKey)
    : 0;

  const memberSince = user.createdAt.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const tierLabels: Record<string, string> = {
    FREE: "Free",
    PRO: "Pro",
    UNLIMITED: "Unlimited",
    ADMIN: "Admin",
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          {t("profile")}
        </h1>
        <Link
          href={`/verkoper/${user.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/30"
        >
          <ExternalLink className="size-3.5" />
          {tp("viewPublicProfile")}
        </Link>
      </div>

      {/* Account overview cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Member since */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="size-4" />
            <span className="text-xs font-medium">{tp("memberSince")}</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">{memberSince}</p>
        </div>

        {/* Account tier */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CreditCard className="size-4" />
            <span className="text-xs font-medium">{tp("accountTier")}</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">
            {tierLabels[user.accountType] ?? user.accountType}
          </p>
        </div>

        {/* Verification */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            {user.isVerified ? <ShieldCheck className="size-4 text-green-500" /> : <Shield className="size-4" />}
            <span className="text-xs font-medium">{tp("verification")}</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            {user.isVerified ? (
              <>
                <span className="text-sm font-semibold text-green-600 dark:text-green-400">{tp("verified")}</span>
                <VerifiedBadge size="sm" />
              </>
            ) : (
              <Link
                href="/dashboard/verificatie"
                className="text-sm font-semibold text-primary hover:text-primary-hover transition-colors"
              >
                {tp("verifyNow")}
              </Link>
            )}
          </div>
        </div>

        {/* Seller level */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Award className="size-4" />
            <span className="text-xs font-medium">{tp("sellerLevel")}</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">
            {sellerLevel?.name ?? "Tin"} ({stats?.xp ?? 0} XP)
          </p>
        </div>
      </div>

      {/* Account info */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <Mail className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{tp("email")}</span>
        </div>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>

      {/* Banner selector */}
      <div className="glass rounded-xl p-6">
        <BannerSelector
          currentBanner={user.profileBanner}
          currentLevelIndex={currentLevelIndex}
        />
      </div>

      {/* Profile edit form */}
      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-6">{tp("editProfile")}</h2>
        <div className="max-w-lg">
          <SessionProvider>
            <ProfileForm user={user} />
          </SessionProvider>
        </div>
      </div>

      {/* Username history */}
      {user.usernameHistory.length > 0 && (
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">{tp("usernameHistory")}</h3>
          <div className="space-y-2">
            {user.usernameHistory.map((h) => (
              <div key={h.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground line-through">{h.oldName}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(h.changedAt).toLocaleDateString("nl-NL", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
