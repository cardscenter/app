import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { MapPin, CalendarDays, Gamepad2, MessageCircle, Pencil, Store } from "lucide-react";
import { hasFeature } from "@/lib/subscription-tiers";
import { getProfileTitle, getHandle } from "@/lib/user-name";
import { getCountryName } from "@/lib/shipping/countries";
import { formatDate } from "@/lib/format";
import { UserAvatar } from "@/components/ui/user-avatar";
import { TrustBadges } from "@/components/ui/trust-badges";
import { TierPill } from "@/components/ui/tier-pill";
import { UsernameHistoryBadge } from "@/components/ui/username-history-tooltip";
import { BlockReportButtons } from "@/components/ui/block-report-buttons";
import { SellerLevelBadge } from "@/components/ui/seller-level-badge";
import { ContactSellerButton } from "@/components/message/contact-seller-button";
import { FollowButton } from "@/components/seller/follow-button";
import { DisplayHeading } from "@/components/ploy/display-heading";
import { Pill } from "@/components/ploy/pill";
import { FloatingBalloon } from "@/components/ploy/balloon";
import type { SellerProfileData } from "@/lib/seller-profile-data";
import type { FeatureSnapshot } from "@/lib/feature-flags";

const PILL_BTN = "cc-pill inline-flex items-center justify-center gap-1.5 px-6 py-4 text-sm font-semibold leading-none no-underline transition-colors";
const PILL_WHITE = `${PILL_BTN} bg-white text-[var(--foreground)] hover:bg-[var(--muted)]`;
const PILL_INK = `${PILL_BTN} bg-[var(--foreground)] text-white hover:bg-[var(--foreground)]/85`;

/**
 * Spelersprofiel-kop (design-pass Fase C): omslag (foto of pastel met
 * zwevende ballonnen) met de grote avatar eroverheen, de naam in de
 * display-letter, @handle, feiten als pillen (plaats, lid sinds, spellen),
 * bio, acties (volgen, bericht, blokkeren) en rechts de tellers in grote
 * cijfers. Handel-zegels alleen bij de flags.
 */
export async function PlayerProfileHeader({
  profile,
  isOwner,
  viewerLoggedIn,
  initiallyBlocked,
  locale,
  features,
  games,
}: {
  profile: SellerProfileData;
  isOwner: boolean;
  viewerLoggedIn: boolean;
  initiallyBlocked: boolean;
  locale: string;
  features: FeatureSnapshot;
  /** Namen van de favoriete spellen (al vertaald/opgezocht door de page). */
  games: string[];
}) {
  const [t, tc] = await Promise.all([getTranslations("sellerProfile"), getTranslations("community")]);
  const { user, stats, activeCounts } = profile;
  const title = getProfileTitle(user);
  const handle = getHandle(user);
  const canShop = hasFeature(user.accountType, "customProfile") && !!user.shopSlug;
  const showShopLink = canShop && (user.shopPublished || isOwner);
  const location = [user.city, user.country ? getCountryName(user.country, locale) : null].filter(Boolean).join(", ");

  const seals = [
    { count: activeCounts.auctions, label: t("sealAuctions", { count: activeCounts.auctions }), show: features.FEATURE_AUCTIONS },
    { count: activeCounts.listings, label: t("sealListings", { count: activeCounts.listings }), show: features.FEATURE_MARKETPLACE },
    { count: activeCounts.claimsales, label: t("sealClaimsales", { count: activeCounts.claimsales }), show: features.FEATURE_CLAIMSALES },
  ].filter((s) => s.show);

  const counters = [
    { label: t("followers"), value: profile.followers },
    { label: t("followingCount"), value: profile.following },
    ...(features.FEATURE_WALLET ? [{ label: t("sales"), value: stats.totalSales }] : []),
  ];
  const fmt = (n: number) => n.toLocaleString(locale === "en" ? "en-GB" : "nl-NL");

  return (
    <section className="flex justify-center px-4 pb-10 pt-2 sm:px-5 lg:px-6 lg:pb-14 lg:pt-4">
      <div className="w-full max-w-6xl">
        {/* Omslag */}
        <div className="relative h-44 overflow-hidden rounded-[var(--radius-panel)] sm:h-60 lg:h-72" style={{ background: "var(--pastel-blue)" }}>
          {user.coverImageUrl ? (
            <Image src={user.coverImageUrl} alt="" fill className="object-cover" sizes="(max-width: 1200px) 100vw, 1152px" priority unoptimized />
          ) : (
            <>
              <FloatingBalloon color="red" shape="cloud" className="pointer-events-none absolute -right-6 -top-10 w-40 sm:w-56" duration={12} />
              <FloatingBalloon color="yellow" shape="flower" className="pointer-events-none absolute left-[18%] -bottom-16 w-32 sm:w-44" duration={16} />
              <FloatingBalloon color="pink" shape="stack" className="pointer-events-none absolute right-[28%] top-6 hidden w-24 sm:block" duration={14} />
            </>
          )}
        </div>

        <div className="flex flex-col gap-8 px-2 sm:px-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-end sm:gap-6">
            <UserAvatar src={user.avatarUrl} name={title} size="4xl" className="relative z-10 -mt-14 size-28 shrink-0 ring-4 ring-[var(--background)] sm:-mt-20 sm:size-40" alt={title} />
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-3">
                <DisplayHeading tag="h1" size={4} text={title} />
                {features.FEATURE_WALLET && <TierPill accountType={user.accountType} />}
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-[var(--foreground)]/55">
                <span>{handle}</span>
                <UsernameHistoryBadge history={profile.usernameHistory} />
                {profile.worksAt.length > 0 && (
                  <span>
                    · {t("worksAt")}{" "}
                    {profile.worksAt.map((w, i) => (
                      <span key={w.businessId}>
                        {i > 0 && ", "}
                        <Link href={`/spelers/${w.businessId}`} className="text-[var(--foreground)] hover:underline">
                          {w.companyName}
                        </Link>
                      </span>
                    ))}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Tellers */}
          <dl className="flex gap-8 sm:gap-10 lg:pt-5">
            {counters.map((c) => (
              <div key={c.label} className="min-w-[4.5rem]">
                <dd className="cc-display text-[40px] leading-none text-[var(--foreground)] sm:text-[48px]">{fmt(c.value)}</dd>
                <dt className="mt-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--foreground)]/50">{c.label}</dt>
              </div>
            ))}
          </dl>
        </div>

        {/* Feiten + bio + acties */}
        <div className="mt-6 px-2 sm:px-4">
          <div className="flex flex-wrap items-center gap-2">
            {location && (
              <Pill tone="white">
                <MapPin className="size-3" /> {location}
              </Pill>
            )}
            <Pill tone="white">
              <CalendarDays className="size-3" /> {t("memberSince")} {formatDate(user.createdAt)}
            </Pill>
            {games.map((g) => (
              <Pill key={g} tone="pastel" color="blue">
                <Gamepad2 className="size-3" /> {g}
              </Pill>
            ))}
            {seals.map((s) => (
              <Pill key={s.label} tone="pastel" color="yellow">
                {s.label}
              </Pill>
            ))}
            {features.FEATURE_XP && <SellerLevelBadge xp={stats.xp} size="sm" />}
            {(user.isVerified || user.isIbanVerified || user.isAddressVerified) && <TrustBadges isVerified={user.isVerified} isIbanVerified={user.isIbanVerified} isAddressVerified={user.isAddressVerified} size="sm" />}
          </div>
          {user.bio ? <p className="cc-prose mt-5 max-w-[42rem] whitespace-pre-line text-base lg:text-lg">{user.bio}</p> : <p className="cc-prose mt-5 text-base">{tc("profileNoBio")}</p>}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {isOwner ? (
              <>
                <Link href="/dashboard/profiel" className={PILL_INK}>
                  <Pencil className="size-4" /> {t("editProfile")}
                </Link>
                {canShop && (
                  <Link href="/dashboard/winkel" className={PILL_WHITE}>
                    <Store className="size-4" /> {t("editShop")}
                  </Link>
                )}
              </>
            ) : (
              <>
                <FollowButton targetUserId={user.id} initiallyFollowing={profile.viewerFollows} loggedIn={viewerLoggedIn} className="h-auto px-6 py-4 leading-none" />
                {viewerLoggedIn ? (
                  <ContactSellerButton sellerId={user.id} label={t("message")} className={PILL_WHITE} />
                ) : (
                  <Link href={`/login?callbackUrl=${encodeURIComponent(`/spelers/${user.id}`)}`} className={PILL_WHITE}>
                    <MessageCircle className="size-4" /> {t("message")}
                  </Link>
                )}
              </>
            )}
            {showShopLink && (
              <Link href={`/winkel/${user.shopSlug}`} className={PILL_WHITE}>
                <Store className="size-4" /> {t("visitShop")}
              </Link>
            )}
          </div>
          {!isOwner && viewerLoggedIn && (
            <div className="mt-4">
              <BlockReportButtons targetUserId={user.id} targetDisplayName={user.displayName} initiallyBlocked={initiallyBlocked} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
