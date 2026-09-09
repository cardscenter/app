import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Pencil, Store, LayoutTemplate } from "lucide-react";
import { getLevelByKey } from "@/lib/seller-levels";
import { hasFeature } from "@/lib/subscription-tiers";
import { formatDate } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button-variants";
import { CountryFlag } from "@/components/ui/country-flag";
import { SellerLevelBadge } from "@/components/ui/seller-level-badge";
import { TrustBadges } from "@/components/ui/trust-badges";
import { TierPill } from "@/components/ui/tier-pill";
import { BlockReportButtons } from "@/components/ui/block-report-buttons";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import type { SellerProfileData } from "@/lib/seller-profile-data";

type Props = {
  profile: SellerProfileData;
  isOwner: boolean;
  viewerLoggedIn: boolean;
  initiallyBlocked: boolean;
  /** "profile" = /verkoper/[id]; "shop" = /winkel/[slug] (slogan onder de naam, Concept-badge). */
  variant: "profile" | "shop";
};

/**
 * Header-kaart van het verkopersprofiel én de winkelpagina (Fase 45):
 * avatar · naam · secundaire regel · acties | feiten-grid 2×3.
 */
export async function SellerProfileHeader({ profile, isOwner, viewerLoggedIn, initiallyBlocked, variant }: Props) {
  const t = await getTranslations("sellerProfile");
  const { user, stats, activeCounts } = profile;
  const isBusiness = user.accountKind === "BUSINESS";
  const displayTitle = isBusiness && user.companyName ? user.companyName : user.displayName;
  const canShop = hasFeature(user.accountType, "customProfile") && !!user.shopSlug;
  const showShopLink = canShop && (user.shopPublished || isOwner);
  const levelBanner = user.profileBanner ? getLevelByKey(user.profileBanner) : undefined;
  const activeTotal = activeCounts.auctions + activeCounts.listings + activeCounts.claimsales;

  const facts: { label: string; value: React.ReactNode }[] = [
    { label: t("memberSince"), value: formatDate(user.createdAt) },
    {
      label: t("location"),
      value: user.city || user.country ? (
        <span className="inline-flex items-center gap-1.5">
          <CountryFlag code={user.country} size="sm" />
          {user.city ?? user.country}
        </span>
      ) : (
        "—"
      ),
    },
    { label: t("level"), value: <SellerLevelBadge xp={stats.xp} size="sm" /> },
    {
      label: t("account"),
      value: (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span>{isBusiness ? t("business") : t("private")}</span>
          <TierPill accountType={user.accountType} />
        </span>
      ),
    },
    {
      label: t("verifications"),
      value:
        user.isVerified || user.isIbanVerified || user.isAddressVerified ? (
          <TrustBadges
            isVerified={user.isVerified}
            isIbanVerified={user.isIbanVerified}
            isAddressVerified={user.isAddressVerified}
            size="sm"
          />
        ) : (
          <span className="text-muted-foreground">{t("noVerifications")}</span>
        ),
    },
    { label: t("activeOffers"), value: String(activeTotal) },
  ];

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      {levelBanner && (
        <div className={`h-3 w-full bg-gradient-to-r ${levelBanner.gradient}`} aria-hidden />
      )}
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_1px_minmax(0,1.3fr)] lg:gap-8">
        {/* Links: identiteit + acties */}
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
          <div className="relative size-24 shrink-0 overflow-hidden rounded-full bg-primary/10 ring-4 ring-background">
            {user.avatarUrl ? (
              <Image src={user.avatarUrl} alt="" fill className="object-cover" sizes="96px" unoptimized />
            ) : (
              <div className="flex size-full items-center justify-center text-3xl font-bold text-primary">
                {displayTitle.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold leading-tight text-foreground">{displayTitle}</h1>
              {variant === "shop" && isOwner && !user.shopPublished && (
                <StatusBadge tone="warning">{t("draft")}</StatusBadge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {variant === "shop" && user.shopTagline ? user.shopTagline : `@${user.displayName}`}
            </p>
            {isBusiness && (user.cocNumber || user.vatNumber) && (
              <p className="mt-1 text-xs text-muted-foreground">
                {[user.cocNumber ? `${t("coc")} ${user.cocNumber}` : null, user.vatNumber ? `${t("vat")} ${user.vatNumber}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {variant === "profile" && user.bio && (
              <p className="mt-2 line-clamp-3 text-sm text-foreground/80">{user.bio}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {isOwner && variant === "profile" && (
                <Link href="/dashboard/profiel" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <Pencil data-icon="inline-start" />
                  {t("editProfile")}
                </Link>
              )}
              {isOwner && variant === "shop" && (
                <Link href="/dashboard/winkel" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <LayoutTemplate data-icon="inline-start" />
                  {t("editShop")}
                </Link>
              )}
              {showShopLink && variant === "profile" && (
                <Link href={`/winkel/${user.shopSlug}`} className={buttonVariants({ variant: "default", size: "sm" })}>
                  <Store data-icon="inline-start" />
                  {t("visitShop")}
                </Link>
              )}
              {!isOwner && viewerLoggedIn && (
                <BlockReportButtons
                  targetUserId={user.id}
                  targetDisplayName={user.displayName}
                  initiallyBlocked={initiallyBlocked}
                />
              )}
            </div>
          </div>
        </div>

        <div className="hidden bg-border lg:block" aria-hidden />

        {/* Rechts: feiten-grid */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{f.label}</dt>
              <dd className="mt-1 text-sm font-medium text-foreground">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
