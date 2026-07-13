import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Palette, Mail, Gavel, EyeOff, Bell, Ban } from "lucide-react";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { SettingsRow } from "@/components/dashboard/ui/settings-row";
import { ThemeToggle } from "@/components/toggle-theme";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { EmailPreferenceRows } from "@/components/dashboard/settings/email-preference-rows";
import { LocalPrefToggle } from "@/components/dashboard/settings/local-pref-toggle";
import { BidConfirmationToggle } from "@/components/dashboard/bid-confirmation-toggle";
import { RunnerUpSettings } from "@/components/dashboard/runner-up-settings";
import { buttonVariants } from "@/components/ui/button";
import { parseEmailPreferences } from "@/lib/email/preferences-config";
import { PREF_HIDE_BALANCE, PREF_ACHIEVEMENT_TOASTS } from "@/lib/local-preferences";

/**
 * Centrale voorkeuren-pagina (Fase 44). Bundelt alles wat eerst verspreid
 * stond: e-mailvoorkeuren (was /meldingen), runner-up + bied-bevestiging
 * (was /profiel), thema/taal (was alleen footer/header) + twee nieuwe
 * device-voorkeuren (saldo verbergen, prestatie-toasts).
 */
export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const t = await getTranslations("settings");
  const tp = await getTranslations("profile");

  const [user, blockedCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        emailPreferences: true,
        emailVerifiedAt: true,
        maxRunnerUpAttempts: true,
        skipBidConfirmation: true,
      },
    }),
    prisma.userBlock.count({ where: { blockerId: session.user.id } }),
  ]);
  if (!user) return null;

  const rowsClass = "divide-y divide-border px-5 py-2";

  return (
    <div className="space-y-6">
      <DashboardPageHeader title={t("title")} subtitle={t("subtitle")} />

      {/* Weergave */}
      <DashboardSection
        icon={<Palette className="size-5" />}
        title={t("sectionDisplay")}
        description={t("sectionDisplayDesc")}
        contentClassName={rowsClass}
      >
        <SettingsRow label={t("theme")} description={t("themeDesc")}>
          <ThemeToggle />
        </SettingsRow>
        <SettingsRow label={t("language")} description={t("languageDesc")}>
          <LanguageSwitcher />
        </SettingsRow>
      </DashboardSection>

      {/* E-mailvoorkeuren */}
      <DashboardSection
        icon={<Mail className="size-5" />}
        title={t("sectionEmail")}
        description={t("sectionEmailDesc")}
        contentClassName="px-5 py-2"
      >
        <EmailPreferenceRows
          initialPrefs={parseEmailPreferences(user.emailPreferences)}
          emailVerified={Boolean(user.emailVerifiedAt)}
        />
      </DashboardSection>

      {/* Bieden & kopen */}
      <DashboardSection
        icon={<Gavel className="size-5" />}
        title={t("sectionTrading")}
        description={t("sectionTradingDesc")}
        contentClassName={rowsClass}
      >
        <SettingsRow
          label={t("bidConfirmation")}
          description={t("bidConfirmationDesc")}
          htmlFor="bid-confirmation"
        >
          <BidConfirmationToggle currentValue={user.skipBidConfirmation} />
        </SettingsRow>
        <SettingsRow
          label={tp("runnerUpTitle")}
          description={tp("runnerUpHelp")}
          layout="stacked"
        >
          <RunnerUpSettings current={user.maxRunnerUpAttempts} />
        </SettingsRow>
      </DashboardSection>

      {/* Privacy */}
      <DashboardSection
        icon={<EyeOff className="size-5" />}
        title={t("sectionPrivacy")}
        description={t("sectionPrivacyDesc")}
        contentClassName={rowsClass}
      >
        <SettingsRow
          label={t("hideBalance")}
          description={t("hideBalanceDesc")}
          htmlFor="pref-hide-balance"
        >
          <LocalPrefToggle id="pref-hide-balance" prefKey={PREF_HIDE_BALANCE} defaultValue={false} />
        </SettingsRow>
        <SettingsRow
          label={t("blockedUsers")}
          description={t("blockedUsersDesc")}
          icon={Ban}
        >
          <Link href="/dashboard/blokkeerlijst" className={buttonVariants({ variant: "outline", size: "sm" })}>
            {t("manageBlockedList")}
            {blockedCount > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                {blockedCount}
              </span>
            )}
          </Link>
        </SettingsRow>
      </DashboardSection>

      {/* Meldingsgedrag */}
      <DashboardSection
        icon={<Bell className="size-5" />}
        title={t("sectionNotifications")}
        description={t("sectionNotificationsDesc")}
        contentClassName={rowsClass}
      >
        <SettingsRow
          label={t("achievementToasts")}
          description={t("achievementToastsDesc")}
          htmlFor="pref-achievement-toasts"
        >
          <LocalPrefToggle id="pref-achievement-toasts" prefKey={PREF_ACHIEVEMENT_TOASTS} defaultValue={true} />
        </SettingsRow>
      </DashboardSection>
    </div>
  );
}
