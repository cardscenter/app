import { getTranslations } from "next-intl/server";
import { Globe, Star } from "lucide-react";
import { formatDate } from "@/lib/format";
import { getLevel, getNextLevel, getLevelProgress } from "@/lib/seller-levels";
import { getCountryName } from "@/lib/shipping/countries";
import { parseSocialLinks, detectSocialPlatform } from "@/lib/events/socials";
import { SocialIcon } from "@/components/events/social-icon";
import { CountryFlag } from "@/components/ui/country-flag";
import { TrustBadges } from "@/components/ui/trust-badges";
import { TierPill } from "@/components/ui/tier-pill";
import type { SellerProfileData } from "@/lib/seller-profile-data";
import type { FeatureSnapshot } from "@/lib/feature-flags";

/**
 * "Over"-tab van het verkopersprofiel (redesign sept 2026): bio, feiten
 * (lid sinds, plaats, account, level, verificaties, beoordeling) en links
 * (website + socials). Bedrijfsgegevens staan hier ook; het team heeft een
 * eigen blok op de pagina.
 */
export async function SellerAboutPanel({
  profile,
  locale,
  features,
}: {
  profile: SellerProfileData;
  locale: string;
  /** Feature-flags van de bezoeker: rating/tier alleen met saldo, level alleen met XP. */
  features: FeatureSnapshot;
}) {
  const t = await getTranslations("sellerProfile");
  const { user, stats } = profile;
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
    {
      label: t("account"),
      value: (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span>{isBusiness ? t("business") : t("private")}</span>
          {features.FEATURE_WALLET && <TierPill accountType={user.accountType} />}
        </span>
      ),
    },
    ...(features.FEATURE_WALLET ? [{
      label: t("rating"),
      value:
        stats.totalReviews > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <Star className="size-4 fill-amber-400 text-amber-400" />
            {stats.avgRating.toFixed(1)}
            <span className="text-muted-foreground">· {t("reviewsCount", { count: stats.totalReviews })}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">{t("reviewsCount", { count: 0 })}</span>
        ),
    }] : []),
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
    ...(features.FEATURE_XP ? [{
      label: t("level"),
      value: (
        <div className="min-w-[10rem]">
          <p>
            {level.icon} {level.name}
          </p>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs font-normal text-muted-foreground">
            {next ? t("xpToNext", { xp: next.minXP - stats.xp, level: next.name }) : t("maxLevel")}
          </p>
        </div>
      ),
    }] : []),
  ];

  if (isBusiness) {
    if (user.cocNumber) facts.push({ label: t("coc"), value: user.cocNumber });
    if (user.vatNumber) facts.push({ label: t("vat"), value: user.vatNumber });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <section className="dash-card p-5 sm:p-6">
          <h3 className="text-[15px] font-semibold text-foreground">{t("aboutHeading")}</h3>
          {user.bio ? (
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground/85">{user.bio}</p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">{t("noBio")}</p>
          )}
        </section>

        {(websiteHost || socialLinks.length > 0) && (
          <section className="dash-card p-5 sm:p-6">
            <h3 className="text-[15px] font-semibold text-foreground">{t("links")}</h3>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {websiteHost && user.websiteUrl && (
                <a
                  href={user.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <Globe className="size-4 text-muted-foreground" />
                  {websiteHost}
                </a>
              )}
              {socialLinks.map((url) => {
                const { platform, label } = detectSocialPlatform(url);
                return (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <SocialIcon platform={platform} className="size-4 text-muted-foreground" />
                    {label}
                  </a>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <section className="dash-card p-5 sm:p-6">
        <h3 className="text-[15px] font-semibold text-foreground">{t("details")}</h3>
        <dl className="mt-3 divide-y divide-border">
          {facts.map((f) => (
            <div key={f.label} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <dt className="shrink-0 text-sm text-muted-foreground">{f.label}</dt>
              <dd className="text-right text-sm font-medium text-foreground">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
