import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Palette, Mail, Gavel, EyeOff, Bell, Ban } from "lucide-react";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { SettingsRow } from "@/components/dashboard/ui/settings-row";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { EmailPreferenceRows } from "@/components/dashboard/settings/email-preference-rows";
import { LocalPrefToggle } from "@/components/dashboard/settings/local-pref-toggle";
import { BidConfirmationToggle } from "@/components/dashboard/bid-confirmation-toggle";
import { RunnerUpSettings } from "@/components/dashboard/runner-up-settings";
import { buttonVariants } from "@/components/ui/button-variants";
import { parseEmailPreferences } from "@/lib/email/preferences-config";
import { PREF_HIDE_BALANCE, PREF_ACHIEVEMENT_TOASTS } from "@/lib/local-preferences";
import { AccountToggle } from "@/components/dashboard/settings/account-toggle";
import { DeleteAccountForm } from "@/components/dashboard/settings/delete-account-form";
import { getFeatureSnapshot } from "@/lib/feature-flags";
import { Newspaper, Users, Trash2 } from "lucide-react";

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
        accountType: true,
        totpEnabled: true,
        showOnParticipantLists: true,
        showOnLeaderboards: true,
        newsletterOptIn: true,
      },
    }),
    prisma.userBlock.count({ where: { blockerId: session.user.id } }),
  ]);
  if (!user) return null;

  const features = getFeatureSnapshot(user.accountType);
  const rowsClass = "divide-y divide-border pt-2";

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
        <SettingsRow label={t("language")} description={t("languageDesc")}>
          <LanguageSwitcher />
        </SettingsRow>
      </DashboardSection>

      {/* E-mailvoorkeuren */}
      <DashboardSection
        icon={<Mail className="size-5" />}
        title={t("sectionEmail")}
        description={t("sectionEmailDesc")}
        contentClassName="pt-2"
      >
        <EmailPreferenceRows
          initialPrefs={parseEmailPreferences(user.emailPreferences)}
          emailVerified={Boolean(user.emailVerifiedAt)}
        />
      </DashboardSection>

      {/* Nieuwsbrief (Community Hub, Fase 2): losse opt-in, nooit vooraf aan */}
      <DashboardSection
        icon={<Newspaper className="size-5" />}
        title={t("sectionNewsletter")}
        description={t("sectionNewsletterDesc")}
        contentClassName={rowsClass}
      >
        <SettingsRow label={t("newsletterOptIn")} description={t("newsletterOptInDesc")} htmlFor="newsletter-opt-in">
          <AccountToggle id="newsletter-opt-in" field="newsletterOptIn" initialValue={user.newsletterOptIn} />
        </SettingsRow>
      </DashboardSection>

      {/* Bieden & kopen (alleen met het handelsmodel) */}
      {features.FEATURE_AUCTIONS && (
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
      )}

      {/* Privacy */}
      <DashboardSection
        icon={<EyeOff className="size-5" />}
        title={t("sectionPrivacy")}
        description={t("sectionPrivacyDesc")}
        contentClassName={rowsClass}
      >
        <SettingsRow
          label={t("showOnParticipantLists")}
          description={t("showOnParticipantListsDesc")}
          icon={Users}
          htmlFor="show-on-participant-lists"
        >
          <AccountToggle id="show-on-participant-lists" field="showOnParticipantLists" initialValue={user.showOnParticipantLists} />
        </SettingsRow>
        <SettingsRow
          label={t("showOnLeaderboards")}
          description={t("showOnLeaderboardsDesc")}
          htmlFor="show-on-leaderboards"
        >
          <AccountToggle id="show-on-leaderboards" field="showOnLeaderboards" initialValue={user.showOnLeaderboards} />
        </SettingsRow>
        {features.FEATURE_WALLET && (
        <SettingsRow
          label={t("hideBalance")}
          description={t("hideBalanceDesc")}
          htmlFor="pref-hide-balance"
        >
          <LocalPrefToggle id="pref-hide-balance" prefKey={PREF_HIDE_BALANCE} defaultValue={false} />
        </SettingsRow>
        )}
        <SettingsRow
          label={t("blockedUsers")}
          description={t("blockedUsersDesc")}
          icon={Ban}
        >
          <Link href="/dashboard/blokkeerlijst" className={buttonVariants({ variant: "outline", size: "sm" })}>
            {t("manageBlockedList")}
            {blockedCount > 0 && (
              <span className="cc-pill bg-[var(--background)] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-foreground/60">
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

      {/* Account verwijderen (AVG, Community Hub Fase 2) */}
      <DashboardSection
        icon={<Trash2 className="size-5" />}
        title={t("sectionDanger")}
        description={t("sectionDangerDesc")}
        contentClassName={rowsClass}
      >
        <SettingsRow label={t("deleteAccount")} description={t("deleteAccountDesc")} layout="stacked">
          <DeleteAccountForm locale={locale} totpEnabled={user.totpEnabled} />
        </SettingsRow>
      </DashboardSection>
    </div>
  );
}
