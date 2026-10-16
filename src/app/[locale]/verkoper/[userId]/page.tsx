import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Globe, Star } from "lucide-react";
import { auth } from "@/lib/auth";
import { isUserBlocked } from "@/actions/block-report";
import { getSellerProfileData } from "@/lib/seller-profile-data";
import { getProfileTitle } from "@/lib/user-name";
import { getFeatureSnapshot } from "@/lib/feature-flags";
import { getUserLeagueSummary } from "@/lib/community/league";
import { listGames } from "@/lib/games-server";
import { parseFavoriteGames } from "@/lib/games";
import { formatDate } from "@/lib/format";
import { getLevel, getNextLevel, getLevelProgress } from "@/lib/seller-levels";
import { getCountryName } from "@/lib/shipping/countries";
import { parseSocialLinks, detectSocialPlatform } from "@/lib/events/socials";
import { formatEventDateShort } from "@/lib/shop-events/format";
import { SocialIcon } from "@/components/events/social-icon";
import { CountryFlag } from "@/components/ui/country-flag";
import { TrustBadges } from "@/components/ui/trust-badges";
import { typePastel } from "@/components/shop-events/event-type-pill";
import { PlayerProfileHeader } from "@/components/community/player-profile-header";
import { SellerHistoryTabs } from "@/components/seller/seller-history-tabs";
import { ProfileOfferGrid } from "@/components/seller/profile-offer-grid";
import { SellerTeamBlock } from "@/components/seller/seller-team-block";
import { ReviewsTable, RecentSalesTable } from "@/components/seller/seller-history-tables";
import { DataCard } from "@/components/ploy/data-card";
import { PunchCard } from "@/components/ploy/punch-card";
import { Pill } from "@/components/ploy/pill";
import { SectionHead } from "@/components/ploy/section-head";
import { TileQuad, type TileItem } from "@/components/ploy/tile-quad";
import { BannerPromo } from "@/components/ploy/banner-promo";
import { CtaButton } from "@/components/ploy/cta-button";
import { PageContainer } from "@/components/layout/page-container";

type Params = Promise<{ locale: string; userId: string }>;

const ANIMATIONS = ["helix", "rain", "waves", "scan", "pulse"] as const;
const TILE_COLORS: Array<TileItem["color"]> = ["green", "blue", "yellow", "pink", "ink"];

export async function generateMetadata({ params }: { params: Promise<{ userId: string }> }): Promise<Metadata> {
  const { userId } = await params;
  const profile = await getSellerProfileData(userId, null);
  if (!profile) return {};
  const title = getProfileTitle(profile.user);
  return {
    title: `${title} (@${profile.user.displayName}) — Cards Center`,
    description: profile.user.bio ?? undefined,
  };
}

/**
 * Publiek spelersprofiel (design-pass Fase C): omslag met ballonnen en
 * grote avatar, naam in de display-letter, feiten als pillen, tellers in
 * grote cijfers; daaronder de league-samenvatting in een datakaart naast
 * de gegevens, de verdiende poorten van Hulst als tegels, en (alleen met
 * handel-flags) de tabs Aanbod · Reviews · Verkopen. Team-blok voor bedrijven.
 */
export default async function SellerProfilePage({ params }: { params: Params }) {
  const { locale, userId } = await params;
  const [t, tc, session] = await Promise.all([getTranslations("sellerProfile"), getTranslations("community"), auth()]);
  const viewerId = session?.user?.id ?? null;

  const profile = await getSellerProfileData(userId, viewerId);
  if (!profile) {
    return (
      <PageContainer width="default" className="py-8">
        <p className="text-center text-muted-foreground">{t("sellerNotFound")}</p>
      </PageContainer>
    );
  }

  const isOwner = viewerId === userId;
  const isLoggedIn = !!viewerId;
  const [initiallyBlocked, league, games] = await Promise.all([!isOwner && isLoggedIn ? isUserBlocked(userId) : Promise.resolve(false), getUserLeagueSummary(userId), listGames()]);
  const { user, stats } = profile;
  const favoriteKeys = parseFavoriteGames(user.favoriteGames, games.map((g) => g.key));
  const favoriteNames = favoriteKeys.map((k) => games.find((g) => g.key === k)?.name ?? k);

  const features = getFeatureSnapshot(session?.user?.accountType);
  const activeOffers = profile.activeOffers.filter((o) => (o.type === "auction" ? features.FEATURE_AUCTIONS : o.type === "claimsale" ? features.FEATURE_CLAIMSALES : features.FEATURE_MARKETPLACE));
  const anyTrade = features.FEATURE_AUCTIONS || features.FEATURE_CLAIMSALES || features.FEATURE_MARKETPLACE;

  const tabs = [
    ...(anyTrade ? [{ key: "offers", label: t("tabOffers"), count: activeOffers.length, content: <ProfileOfferGrid offers={activeOffers} isOwner={isOwner} /> }] : []),
    ...(features.FEATURE_WALLET ? [{ key: "reviews", label: t("tabReviews"), count: profile.reviews.length, content: <ReviewsTable reviews={profile.reviews} /> }] : []),
    ...(profile.recentSales && features.FEATURE_WALLET ? [{ key: "sales", label: t("tabSales"), count: profile.recentSales.length, content: <RecentSalesTable sales={profile.recentSales} /> }] : []),
  ];

  // Gegevens-rijen (voorheen de "Over"-tab).
  const isBusiness = user.accountKind === "BUSINESS";
  const level = getLevel(stats.xp);
  const next = getNextLevel(stats.xp);
  const progress = getLevelProgress(stats.xp);
  const socialLinks = parseSocialLinks(user.socialLinks);
  const websiteHost = user.websiteUrl
    ? (() => {
        try {
          return new URL(user.websiteUrl).hostname.replace(/^www\./, "");
        } catch {
          return user.websiteUrl;
        }
      })()
    : null;
  const facts: { label: string; value: React.ReactNode }[] = [
    { label: t("memberSince"), value: formatDate(user.createdAt) },
    {
      label: t("location"),
      value:
        user.city || user.country ? (
          <span className="inline-flex items-center gap-1.5">
            <CountryFlag code={user.country} size="sm" />
            {[user.city, user.country ? getCountryName(user.country, locale) : null].filter(Boolean).join(", ")}
          </span>
        ) : (
          "—"
        ),
    },
    { label: t("account"), value: isBusiness ? t("business") : t("private") },
    ...(favoriteNames.length > 0 ? [{ label: tc("profileGames"), value: favoriteNames.join(", ") }] : []),
    ...(features.FEATURE_WALLET
      ? [
          {
            label: t("rating"),
            value:
              stats.totalReviews > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <Star className="size-4 fill-amber-400 text-amber-400" />
                  {stats.avgRating.toFixed(1)}
                  <span className="text-[var(--foreground)]/55">· {t("reviewsCount", { count: stats.totalReviews })}</span>
                </span>
              ) : (
                <span className="text-[var(--foreground)]/55">{t("reviewsCount", { count: 0 })}</span>
              ),
          },
        ]
      : []),
    {
      label: t("verifications"),
      value: user.isVerified || user.isIbanVerified || user.isAddressVerified ? <TrustBadges isVerified={user.isVerified} isIbanVerified={user.isIbanVerified} isAddressVerified={user.isAddressVerified} size="sm" /> : <span className="text-[var(--foreground)]/55">{t("noVerifications")}</span>,
    },
    ...(features.FEATURE_XP
      ? [
          {
            label: t("level"),
            value: (
              <div className="min-w-[10rem]">
                <p>
                  {level.icon} {level.name}
                </p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--muted)]">
                  <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-1 text-xs font-normal text-[var(--foreground)]/55">{next ? t("xpToNext", { xp: next.minXP - stats.xp, level: next.name }) : t("maxLevel")}</p>
              </div>
            ),
          },
        ]
      : []),
  ];
  if (isBusiness) {
    if (user.cocNumber) facts.push({ label: t("coc"), value: user.cocNumber });
    if (user.vatNumber) facts.push({ label: t("vat"), value: user.vatNumber });
  }

  const badgeTiles: TileItem[] = league.badges.map((b, i) => ({
    title: b.name,
    color: TILE_COLORS[i % TILE_COLORS.length]!,
    animation: ANIMATIONS[i % ANIMATIONS.length],
    text: (
      <>
        {b.description && <p>{b.description}</p>}
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.1em] opacity-70">
          {formatEventDateShort(new Date(b.awardedAt), locale)}
          {b.seasonName ? ` · ${b.seasonName}` : ""}
        </p>
      </>
    ),
    action: <Pill tone="pastel" color={typePastel(b.color)}>{tc("profileBadgeEarned")}</Pill>,
  }));

  const record = `${league.wins}-${league.losses}-${league.draws}`;

  return (
    <div className="cc-landing overflow-clip">
      <PlayerProfileHeader profile={profile} isOwner={isOwner} viewerLoggedIn={isLoggedIn} initiallyBlocked={initiallyBlocked} locale={locale} features={features} games={favoriteNames} />

      {/* League + gegevens */}
      <section className="flex justify-center px-4 pb-12 sm:px-5 lg:px-6 lg:pb-16">
        <div className="grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <DataCard
            badge={tc("profileLeagueBadge")}
            badgeColor="green"
            title={league.season ? league.season.name : tc("noSeasonTitle")}
            columns={4}
            tiles={[
              { label: tc("profileRank"), value: league.rank ? `#${league.rank}` : "—", hint: league.rank ? undefined : tc("noPositionYet") },
              { label: tc("points"), value: String(league.points) },
              { label: tc("eventsPlayed"), value: String(league.events) },
              { label: tc("record"), value: record, hint: `${tc("wins")} · ${tc("losses")} · ${tc("draws")}` },
            ]}
          >
            {league.recentResults.length > 0 ? (
              <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)] text-sm">
                {league.recentResults.slice(0, 5).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--foreground)]">{r.eventTitle ?? tc("profileLooseResult")}</p>
                      <p className="text-xs text-[var(--foreground)]/55">
                        {formatEventDateShort(new Date(r.date), locale)} · {r.seasonName}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-bold tabular-nums text-[var(--foreground)]">+{r.points}</p>
                      <p className="text-xs tabular-nums text-[var(--foreground)]/55">
                        {r.wins}-{r.losses}-{r.draws}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="cc-prose text-sm">{tc("profileNoResults")}</p>
            )}
            <div className="mt-5">
              <CtaButton href="/league" variant="light">
                {tc("viewLeague")}
              </CtaButton>
            </div>
          </DataCard>

          <PunchCard className="bg-white p-6 sm:p-7" dot="var(--border)">
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">{t("details")}</h2>
            <dl className="mt-3 divide-y divide-[var(--border)]">
              {facts.map((f) => (
                <div key={f.label} className="flex items-start justify-between gap-4 py-3">
                  <dt className="shrink-0 text-sm text-[var(--foreground)]/55">{f.label}</dt>
                  <dd className="text-right text-sm font-semibold text-[var(--foreground)]">{f.value}</dd>
                </div>
              ))}
            </dl>
            {(websiteHost || socialLinks.length > 0) && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-4">
                {websiteHost && user.websiteUrl && (
                  <a href={user.websiteUrl} target="_blank" rel="noopener noreferrer nofollow" className="cc-pill inline-flex items-center gap-1.5 bg-[var(--background)] px-3 py-1.5 text-sm font-semibold text-[var(--foreground)] no-underline hover:bg-[var(--muted)]">
                    <Globe className="size-4 text-[var(--foreground)]/55" />
                    {websiteHost}
                  </a>
                )}
                {socialLinks.map((url) => {
                  const { platform, label } = detectSocialPlatform(url);
                  return (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer nofollow" className="cc-pill inline-flex items-center gap-1.5 bg-[var(--background)] px-3 py-1.5 text-sm font-semibold text-[var(--foreground)] no-underline hover:bg-[var(--muted)]">
                      <SocialIcon platform={platform} className="size-4 text-[var(--foreground)]/55" />
                      {label}
                    </a>
                  );
                })}
              </div>
            )}
          </PunchCard>
        </div>
      </section>

      {/* Poorten van Hulst */}
      <section className="flex justify-center px-4 sm:px-5 lg:px-6">
        <div className="w-full max-w-6xl">
          <SectionHead eyebrow={tc("badgesTitle")} eyebrowColor="pink" title={tc("profileBadges")} intro={badgeTiles.length > 0 ? tc("profileBadgesIntro", { n: badgeTiles.length }) : tc("noBadges")} size={4} />
        </div>
      </section>
      {badgeTiles.length > 0 ? (
        <TileQuad items={badgeTiles} columns={3} />
      ) : (
        <section className="flex justify-center px-4 pb-12 sm:px-5 lg:px-6 lg:pb-16">
          <div className="w-full max-w-6xl">
            <PunchCard className="bg-white px-6 py-10 text-center" dot="var(--border)">
              <p className="cc-prose mx-auto max-w-[28rem] text-base">{isOwner ? tc("profileBadgesEmptyOwner") : tc("profileBadgesEmpty")}</p>
              <div className="mt-5">
                <CtaButton href="/evenementen" variant="dark">
                  {tc("toEvents")}
                </CtaButton>
              </div>
            </PunchCard>
          </div>
        </section>
      )}

      {tabs.length > 0 && (
        <section className="flex justify-center px-4 pb-12 sm:px-5 lg:px-6 lg:pb-16">
          <div className="w-full max-w-6xl">
            <SellerHistoryTabs tabs={tabs} />
          </div>
        </section>
      )}

      {user.accountKind === "BUSINESS" && (
        <section className="flex justify-center px-4 pb-12 sm:px-5 lg:px-6 lg:pb-16">
          <div className="w-full max-w-6xl">
            <SellerTeamBlock profile={profile} isOwner={isOwner} />
          </div>
        </section>
      )}

      {!isLoggedIn && (
        <BannerPromo
          eyebrow={tc("profileJoinEyebrow")}
          title={tc("profileJoinTitle")}
          text={tc("profileJoinText")}
          note={tc("profileJoinNote")}
          action={
            <CtaButton href="/register" variant="light">
              {tc("profileJoinCta")}
            </CtaButton>
          }
        />
      )}
    </div>
  );
}
