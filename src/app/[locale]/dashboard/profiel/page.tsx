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
import { BusinessTeamManager } from "@/components/dashboard/business-team-manager";
import { BusinessInvites } from "@/components/dashboard/business-invites";
import { getFullName, getProfileTitle } from "@/lib/user-name";
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
import { decryptIban } from "@/lib/iban-crypto";
import { formatDateShort } from "@/lib/format";
import { USERNAME_CHANGE_FEE, getUsernameChangeState } from "@/lib/username-change-config";
import { PlayerProfileForm } from "@/components/dashboard/player-profile-form";
import { listGames } from "@/lib/games-server";
import { readPlayerProfile } from "@/actions/player-profile";
import { getFeatureSnapshot } from "@/lib/feature-flags";

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

  const usernameChange = getUsernameChangeState(user.lastUsernameChange);

  const isBusiness = user.accountKind === "BUSINESS";
  const features = getFeatureSnapshot(user.accountType);
  const canShop = features.FEATURE_WALLET && hasFeature(user.accountType, "customProfile");

  // Spelersgegevens (Community Hub, Fase 2)
  const [games, playerProfile] = await Promise.all([
    listGames(),
    readPlayerProfile({ dateOfBirth: user.dateOfBirth, favoriteGames: user.favoriteGames, playerIds: user.playerIds }),
  ]);

  // Bedrijfsteam (profiel-redesign sept 2026): als bedrijf beheer je je team,
  // als persoon zie je uitnodigingen + de bedrijven waar je bij hoort.
  const [teamRaw, membershipsRaw] = await Promise.all([
    isBusiness
      ? prisma.businessMember.findMany({
          where: { businessId: user.id },
          select: {
            id: true,
            title: true,
            status: true,
            user: { select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true } },
          },
          orderBy: [{ status: "asc" }, { invitedAt: "asc" }],
        })
      : Promise.resolve([]),
    prisma.businessMember.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        title: true,
        status: true,
        business: { select: { id: true, displayName: true, firstName: true, lastName: true, accountKind: true, companyName: true, avatarUrl: true } },
      },
      orderBy: [{ status: "desc" }, { invitedAt: "asc" }],
    }),
  ]);
  const teamMembers = teamRaw.map((m) => ({
    id: m.id,
    userId: m.user.id,
    displayName: m.user.displayName,
    fullName: getFullName(m.user),
    avatarUrl: m.user.avatarUrl,
    title: m.title,
    status: m.status,
  }));
  const memberships = membershipsRaw.map((m) => ({
    id: m.id,
    businessId: m.business.id,
    companyName: getProfileTitle(m.business),
    avatarUrl: m.business.avatarUrl,
    title: m.title,
    status: m.status,
  }));

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
            <Link href={`/spelers/${user.id}`} className={buttonVariants({ variant: "outline" })}>
              <ExternalLink className="size-3.5" />
              {tp("viewPublicProfile")}
            </Link>
          </>
        }
      />

      {/* BLOK 1 — Openbaar profiel: omslag + naam + foto + bio + locatie + links */}
      <section className="overflow-hidden dash-card">
        <ProfileForm
          usernameChangeFee={USERNAME_CHANGE_FEE}
          user={{
            displayName: user.displayName,
            firstName: user.firstName,
            lastName: user.lastName,
            fullNameLocked: user.fullNameLockedAt !== null,
            canChangeUsername: usernameChange.canChange,
            usernameChangedAt: usernameChange.usedAt,
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

      {/* BLOK 1b — Spelersgegevens (Community Hub, Fase 2; privé behalve de spellen) */}
      <DashboardSection
        title={tp("playerSection")}
        description={tp("playerSectionHint")}
        contentClassName="px-5 py-6 sm:px-6"
      >
        <PlayerProfileForm
          games={games}
          initial={{
            ...playerProfile,
            guardianName: user.guardianName ?? "",
            guardianEmail: user.guardianEmail ?? "",
            guardianPhone: user.guardianPhone ?? "",
            guardianConsentAt: user.guardianConsentAt?.toISOString() ?? null,
          }}
        />
      </DashboardSection>

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

        {features.FEATURE_WALLET && (
        <FieldRow label={tp("accountTier")} hint={tp("accountTierHint")}>
          <div className="flex items-center justify-between gap-3 rounded-[12px] border border-[var(--border)] bg-white px-3 py-2.5">
            <TierPill accountType={user.accountType} />
            <Link
              href="/dashboard/abonnement"
              className="text-xs font-medium text-primary transition-colors hover:text-primary-hover"
            >
              {tp("manage")} →
            </Link>
          </div>
        </FieldRow>
        )}

        {!isBusiness && memberships.length > 0 && (
          <FieldRow id="team" label={tp("membershipsLabel")} hint={tp("membershipsHint")}>
            <BusinessInvites rows={memberships} />
          </FieldRow>
        )}

        {user.usernameHistory.length > 0 && (
          <FieldRow label={tp("usernameHistory")} hint={tp("usernameHistoryHint")}>
            <ul className="divide-y divide-border rounded-[12px] border border-[var(--border)] bg-white">
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
          <FieldRow id="team" label={tp("teamLabel")} hint={tp("teamHint")}>
            <BusinessTeamManager members={teamMembers} />
          </FieldRow>
        </DashboardSection>
      )}

      {/* BLOK 5 — Bankgegevens (uitbetalingen van het saldo; inkoop vraagt
          het IBAN per aanvraag, dus zonder wallet-flag is dit blok weg) */}
      {features.FEATURE_WALLET && (
      <DashboardSection
        title={tp("bankSection")}
        description={tp("bankSectionHint", { days: IBAN_COOLDOWN_DAYS })}
        contentClassName="px-5 py-6 sm:px-6"
      >
        <FieldRow label={tp("bankAccountLabel")} hint={tp("bankAccountHint")}>
          <BankDetailsForm
            iban={decryptIban(user.iban)}
            accountHolderName={user.accountHolderName}
            lastIbanChange={user.lastIbanChange?.toISOString() ?? null}
            cooldownDays={IBAN_COOLDOWN_DAYS}
          />
        </FieldRow>
      </DashboardSection>
      )}
    </div>
  );
}
