import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ExternalLink, Store } from "lucide-react";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { PasswordChangeForm } from "@/components/dashboard/password-change-form";
import { TwoFactorSettings } from "@/components/dashboard/two-factor-settings";
import { AddressForm } from "@/components/dashboard/address-form";
import { BankDetailsForm } from "@/components/dashboard/bank-details-form";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { FieldRow } from "@/components/dashboard/ui/field-row";
import { TierPill } from "@/components/ui/tier-pill";
import { buttonVariants } from "@/components/ui/button-variants";
import { getLevel, getLevelByKey } from "@/lib/seller-levels";
import { getSellerStats } from "@/actions/review";
import { hasFeature } from "@/lib/subscription-tiers";
import { parseSocialLinks } from "@/lib/events/socials";
import { IBAN_COOLDOWN_DAYS } from "@/lib/validations/iban";
import { formatDateShort } from "@/lib/format";

/**
 * /dashboard/profiel (redesign sept 2026, naar Connext-referentie):
 * één publiek "profiel"-blok met omslagfoto + rijen label-links/veld-rechts,
 * daarna alleen nog een nieuwe kaart als het écht een ander onderwerp is:
 * Account & beveiliging · Adres · Bedrijfsgegevens (zakelijk) · Bankgegevens.
 * Geen KPI-tegels meer — die informatie leeft op het openbare profiel.
 */
export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);
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
  const currentLevel = stats ? getLevel(stats.xp) : null;
  const bannerLevel = user.profileBanner ? getLevelByKey(user.profileBanner) : undefined;
  const fallbackGradient =
    bannerLevel?.gradient ?? currentLevel?.gradient ?? "from-sky-200 via-violet-200 to-pink-200";

  const isBusiness = user.accountKind === "BUSINESS";
  const canShop = hasFeature(user.accountType, "customProfile");

  const readOnlyValue = "text-sm text-foreground md:pt-2";

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={t("profile")}
        subtitle={tp("subtitle")}
        action={
          <>
            {canShop && (
              <Link href="/dashboard/winkel" className={buttonVariants({ variant: "outline" })}>
                <Store className="size-3.5" />
                {tp("shopPage")}
              </Link>
            )}
            <Link href={`/verkoper/${user.id}`} className={buttonVariants({ variant: "outline" })}>
              <ExternalLink className="size-3.5" />
              {tp("viewPublicProfile")}
            </Link>
          </>
        }
      />

      {/* BLOK 1 — Openbaar profiel: omslag + naam + foto + bio + locatie + links */}
      <section className="overflow-hidden dash-card">
        <ProfileForm
          user={{
            displayName: user.displayName,
            bio: user.bio,
            avatarUrl: user.avatarUrl,
            coverImageUrl: user.coverImageUrl,
            websiteUrl: user.websiteUrl,
            city: user.city,
            country: user.country,
          }}
          socialLinks={parseSocialLinks(user.socialLinks)}
          fallbackGradient={fallbackGradient}
        />
      </section>

      {/* BLOK 2 — Account & beveiliging (privé) */}
      <DashboardSection
        title={tp("accountSection")}
        description={tp("accountSectionHint")}
        contentClassName="px-5 py-6 sm:px-6"
      >
        <FieldRow label={tp("email")} hint={tp("emailHint")}>
          <p className={readOnlyValue}>{user.email}</p>
        </FieldRow>

        <FieldRow label={tp("password")} hint={tp("passwordHint")}>
          <PasswordChangeForm />
        </FieldRow>

        <FieldRow label={tp("twoFactor")} hint={tp("twoFactorHint")}>
          <TwoFactorSettings enabled={user.totpEnabled} />
        </FieldRow>

        <FieldRow label={tp("accountTier")} hint={tp("accountTierHint")}>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <TierPill accountType={user.accountType} />
            <Link
              href="/dashboard/abonnement"
              className="text-xs font-medium text-primary transition-colors hover:text-primary-hover"
            >
              {tp("manage")} →
            </Link>
          </div>
        </FieldRow>

        {user.usernameHistory.length > 0 && (
          <FieldRow label={tp("usernameHistory")} hint={tp("usernameHistoryHint")}>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {user.usernameHistory.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="text-muted-foreground line-through">@{h.oldName}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatDateShort(h.changedAt)}
                  </span>
                </li>
              ))}
            </ul>
          </FieldRow>
        )}
      </DashboardSection>

      {/* BLOK 3 — Adres (gedeeld met /verzending via dezelfde AddressForm) */}
      <div id="adres" className="scroll-mt-24">
        <DashboardSection
          title={tp("addressSection")}
          description={tp("addressSectionHint")}
          contentClassName="px-5 py-6 sm:px-6"
        >
          <FieldRow label={tp("addressLabel")} hint={tp("addressLabelHint")}>
            <AddressForm user={user} />
          </FieldRow>
        </DashboardSection>
      </div>

      {/* BLOK 4 — Bedrijfsgegevens (alleen zakelijke accounts, read-only) */}
      {isBusiness && (
        <DashboardSection
          title={tp("businessSection")}
          description={tp("businessSectionHint")}
          contentClassName="px-5 py-6 sm:px-6"
        >
          <FieldRow label={tp("companyName")}>
            <p className={readOnlyValue}>{user.companyName ?? "—"}</p>
          </FieldRow>
          <FieldRow label={tp("cocNumber")}>
            <p className={readOnlyValue}>{user.cocNumber ?? "—"}</p>
          </FieldRow>
          <FieldRow label={tp("vatNumber")}>
            <p className={readOnlyValue}>{user.vatNumber ?? "—"}</p>
          </FieldRow>
        </DashboardSection>
      )}

      {/* BLOK 5 — Bankgegevens */}
      <DashboardSection
        title={tp("bankSection")}
        description={tp("bankSectionHint", { days: IBAN_COOLDOWN_DAYS })}
        contentClassName="px-5 py-6 sm:px-6"
      >
        <FieldRow label={tp("bankAccountLabel")} hint={tp("bankAccountHint")}>
          <BankDetailsForm
            iban={user.iban}
            accountHolderName={user.accountHolderName}
            lastIbanChange={user.lastIbanChange?.toISOString() ?? null}
            cooldownDays={IBAN_COOLDOWN_DAYS}
          />
        </FieldRow>
      </DashboardSection>
    </div>
  );
}
