import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Pencil, Store, LayoutTemplate, MessageCircle, Badge as SealIcon, Gavel, Tag } from "lucide-react";
import { getLevelByKey, getLevel } from "@/lib/seller-levels";
import { hasFeature } from "@/lib/subscription-tiers";
import { getProfileTitle, getHandle } from "@/lib/user-name";
import { getCountryName } from "@/lib/shipping/countries";
import { UserAvatar } from "@/components/ui/user-avatar";
import { CountryFlag } from "@/components/ui/country-flag";
import { SellerLevelBadge } from "@/components/ui/seller-level-badge";
import { TrustBadges } from "@/components/ui/trust-badges";
import { TierPill } from "@/components/ui/tier-pill";
import { UsernameHistoryBadge } from "@/components/ui/username-history-tooltip";
import { BlockReportButtons } from "@/components/ui/block-report-buttons";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import { ContactSellerButton } from "@/components/message/contact-seller-button";
import { FollowButton } from "@/components/seller/follow-button";
import type { SellerProfileData } from "@/lib/seller-profile-data";
import type { FeatureSnapshot } from "@/lib/feature-flags";

type Props = {
  profile: SellerProfileData;
  isOwner: boolean;
  viewerLoggedIn: boolean;
  initiallyBlocked: boolean;
  /** "profile" = /verkoper/[id] (eigen omslag); "shop" = /winkel/[slug] (banner staat al boven de kaart). */
  variant: "profile" | "shop";
  locale: string;
  /** Feature-flags van de bezoeker (Community Hub, Fase 1): zegels/tellers per handelssoort. */
  features: FeatureSnapshot;
};

const PILL_OUTLINE =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted";

/**
 * Profielkop (redesign sept 2026, naar de Portfolia-referentie): omslag →
 * grote avatar met afgeronde hoeken die over de omslag valt → volledige naam
 * + tier · @gebruikersnaam · plaats → Volgen + Bericht sturen; rechts drie
 * "zegels" met het aantal veilingen/advertenties/claimsales en de tellers
 * Volgers · Volgend · Verkopen. Geen kaart-rand: de kop ligt op de pagina.
 */
export async function SellerProfileHeader({ profile, isOwner, viewerLoggedIn, initiallyBlocked, variant, locale, features }: Props) {
  const t = await getTranslations("sellerProfile");
  const { user, stats, activeCounts } = profile;
  const isBusiness = user.accountKind === "BUSINESS";
  const title = getProfileTitle(user);
  const handle = getHandle(user);
  const canShop = hasFeature(user.accountType, "customProfile") && !!user.shopSlug;
  const showShopLink = canShop && (user.shopPublished || isOwner);
  const level = getLevel(stats.xp);
  const bannerLevel = user.profileBanner ? getLevelByKey(user.profileBanner) : undefined;
  const gradient = bannerLevel?.gradient ?? level.gradient;
  const showCover = variant === "profile";
  const location = [user.city, user.country ? getCountryName(user.country, locale) : null].filter(Boolean).join(", ");

  const seals: { count: number; tone: string; label: string; icon: React.ReactNode; show: boolean }[] = [
    { count: activeCounts.auctions, tone: "text-blue-600", label: t("sealAuctions", { count: activeCounts.auctions }), icon: <Gavel className="size-3" />, show: features.FEATURE_AUCTIONS },
    { count: activeCounts.listings, tone: "text-emerald-600", label: t("sealListings", { count: activeCounts.listings }), icon: <Store className="size-3" />, show: features.FEATURE_MARKETPLACE },
    { count: activeCounts.claimsales, tone: "text-amber-500", label: t("sealClaimsales", { count: activeCounts.claimsales }), icon: <Tag className="size-3" />, show: features.FEATURE_CLAIMSALES },
  ].filter((s) => s.show);

  const counters: { label: string; value: number }[] = [
    { label: t("followers"), value: profile.followers },
    { label: t("followingCount"), value: profile.following },
    ...(features.FEATURE_WALLET ? [{ label: t("sales"), value: stats.totalSales }] : []),
  ];

  return (
    <section>
      {/* Omslag */}
      {showCover && (
        <div className="relative h-40 overflow-hidden rounded-2xl bg-card sm:h-52">
          {user.coverImageUrl ? (
            <Image src={user.coverImageUrl} alt="" fill className="object-cover" sizes="(max-width: 1440px) 100vw, 1440px" priority unoptimized />
          ) : (
            <>
              <div className={`absolute -right-10 -top-24 h-72 w-[70%] rounded-full bg-gradient-to-r ${gradient} opacity-30 blur-3xl`} aria-hidden />
              <div className={`absolute -bottom-32 left-[20%] h-64 w-[55%] rounded-full bg-gradient-to-r ${gradient} opacity-15 blur-3xl`} aria-hidden />
            </>
          )}
        </div>
      )}

      {/* Identiteit + tellers */}
      <div className="flex flex-col gap-6 px-2 pt-3 sm:px-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
          <UserAvatar
            src={user.avatarUrl}
            name={title}
            size="4xl"
            className={`relative z-10 ring-4 ring-background shadow-card ${showCover ? "size-32 -mt-16 sm:size-44 sm:-mt-24" : "size-28 sm:size-32"}`}
            alt={title}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">{title}</h1>
              <TierPill accountType={user.accountType} />
              {variant === "shop" && isOwner && !user.shopPublished && (
                <StatusBadge tone="warning">{t("draft")}</StatusBadge>
              )}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground/80">{handle}</span>
              <UsernameHistoryBadge history={profile.usernameHistory} />
              {location && (
                <>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <CountryFlag code={user.country} size="xs" />
                    {location}
                  </span>
                </>
              )}
              {isBusiness && (user.cocNumber || user.vatNumber) && (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    {[user.cocNumber ? `${t("coc")} ${user.cocNumber}` : null, user.vatNumber ? `${t("vat")} ${user.vatNumber}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </>
              )}
              {profile.worksAt.length > 0 && (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    {t("worksAt")}{" "}
                    {profile.worksAt.map((w, i) => (
                      <span key={w.businessId}>
                        {i > 0 && ", "}
                        <Link href={`/verkoper/${w.businessId}`} className="font-medium text-foreground hover:underline">
                          {w.companyName}
                        </Link>
                      </span>
                    ))}
                  </span>
                </>
              )}
            </p>
            {variant === "shop" && user.shopTagline ? (
              <p className="mt-2 max-w-xl text-sm text-foreground/80">{user.shopTagline}</p>
            ) : user.bio ? (
              <p className="mt-2 line-clamp-2 max-w-xl whitespace-pre-line text-sm text-foreground/80">{user.bio}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <SellerLevelBadge xp={stats.xp} size="sm" />
              {(user.isVerified || user.isIbanVerified || user.isAddressVerified) && (
                <TrustBadges
                  isVerified={user.isVerified}
                  isIbanVerified={user.isIbanVerified}
                  isAddressVerified={user.isAddressVerified}
                  size="sm"
                />
              )}
            </div>

            {/* Acties */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {isOwner ? (
                <>
                  <Link href="/dashboard/profiel" className={PILL_OUTLINE}>
                    <Pencil className="size-4" />
                    {t("editProfile")}
                  </Link>
                  {canShop && (
                    <Link href="/dashboard/winkel" className={PILL_OUTLINE}>
                      <LayoutTemplate className="size-4" />
                      {t("editShop")}
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <FollowButton targetUserId={user.id} initiallyFollowing={profile.viewerFollows} loggedIn={viewerLoggedIn} />
                  {viewerLoggedIn ? (
                    <ContactSellerButton sellerId={user.id} label={t("message")} className={PILL_OUTLINE} />
                  ) : (
                    <Link href={`/login?callbackUrl=${encodeURIComponent(`/verkoper/${user.id}`)}`} className={PILL_OUTLINE}>
                      <MessageCircle className="size-4" />
                      {t("message")}
                    </Link>
                  )}
                </>
              )}
              {showShopLink && variant === "profile" && (
                <Link href={`/winkel/${user.shopSlug}`} className={PILL_OUTLINE}>
                  <Store className="size-4" />
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

        {/* Rechts: zegels + tellers */}
        <div className="flex shrink-0 flex-col items-start gap-5 lg:items-end lg:pt-1">
          {seals.length > 0 && (
          <div className="flex items-center gap-1.5" aria-label={t("activeOffers")}>
            {seals.map((s) => (
              <span key={s.label} title={s.label} className={`relative inline-flex size-10 items-center justify-center ${s.tone}`}>
                <SealIcon className="absolute inset-0 size-10 fill-current" strokeWidth={0} aria-hidden />
                <span className="relative text-xs font-bold text-white">{s.count}</span>
              </span>
            ))}
          </div>
          )}
          <dl className="flex gap-8 sm:gap-10">
            {counters.map((c) => (
              <div key={c.label} className="min-w-[4.5rem]">
                <dt className="text-xs font-medium text-muted-foreground">{c.label}</dt>
                <dd className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-foreground sm:text-3xl">
                  {c.value.toLocaleString(locale === "en" ? "en-GB" : "nl-NL")}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

    </section>
  );
}
