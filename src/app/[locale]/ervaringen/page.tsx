import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { listApprovedTestimonials } from "@/lib/community/testimonials";
import { CenteredHero } from "@/components/ploy/centered-hero";
import { CtaButton } from "@/components/ploy/cta-button";
import { TestimonialWall, type TestimonialItem } from "@/components/ploy/testimonial-wall";
import { BannerPromo } from "@/components/ploy/banner-promo";
import { ClosingCta } from "@/components/ploy/closing-cta";
import { PunchCard } from "@/components/ploy/punch-card";
import { DisplayHeading } from "@/components/ploy/display-heading";
import { Balloon } from "@/components/ploy/balloon";
import { PLATFORM } from "@/lib/platform-config";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "community" });
  return { title: `${t("expTitle")} | Cards Center`, description: t("expMeta") };
}

/**
 * Ervaringen van spelers (design-pass Fase C, referentie "the ploy effect"):
 * hero, muur van quotes in punch-cards, strook "deel je ervaring" en slotpaneel.
 */
export default async function ExperiencesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, rows, session] = await Promise.all([getTranslations("community"), listApprovedTestimonials(), auth()]);
  const viewerId = session?.user?.id ?? null;
  const items: TestimonialItem[] = rows.map((r) => ({
    id: r.id,
    quote: r.quote,
    authorName: r.authorName,
    authorRole: r.authorRole,
    sourceLabel: t(`expSource_${r.source}`),
    sourceUrl: r.sourceUrl,
    avatarUrl: r.avatarUrl,
    color: r.color,
  }));

  return (
    <div className="cc-landing overflow-clip">
      <CenteredHero eyebrow={t("expEyebrow")} eyebrowColor="pink" title={t("expHeroTitle")} highlightWord={t("expHeroWord")} highlightColor="pink" description={t("expIntro", { city: PLATFORM.shop.city })}>
        <CtaButton href="/evenementen" variant="red">
          {t("expCtaEvents")}
        </CtaButton>
        <CtaButton href="/info" variant="light">
          {t("expCtaInfo")}
        </CtaButton>
      </CenteredHero>

      <section className="flex justify-center px-4 pb-12 sm:px-5 lg:px-6 lg:pb-16">
        <div className="w-full max-w-6xl">
          {items.length > 0 ? (
            <TestimonialWall items={items} columns={3} />
          ) : (
            <PunchCard className="relative overflow-hidden bg-white px-6 py-14 text-center sm:px-12" dot="var(--border)">
              <Balloon color="pink" shape="stack" className="pointer-events-none absolute -right-8 -top-8 w-36 opacity-90" />
              <div className="relative mx-auto max-w-[30rem]">
                <DisplayHeading tag="h2" size={4} text={t("expEmptyTitle")} className="text-center" />
                <p className="cc-prose mt-3 text-base">{t("expEmptyText")}</p>
              </div>
            </PunchCard>
          )}
        </div>
      </section>

      <BannerPromo
        eyebrow={t("expShareEyebrow")}
        title={t("expShareTitle")}
        text={t("expShareText")}
        note={t("expShareNote")}
        action={
          <CtaButton href="/support" variant="light">
            {t("expShareCta")}
          </CtaButton>
        }
      />

      <ClosingCta color="pink" title={t("expClosingTitle")} text={t("expClosingText", { city: PLATFORM.shop.city })}>
        <CtaButton href="/evenementen" variant="red">
          {t("expCtaEvents")}
        </CtaButton>
        <CtaButton href={viewerId ? "/dashboard" : "/register"} variant="light">
          {viewerId ? t("expClosingDashboard") : t("expClosingRegister")}
        </CtaButton>
      </ClosingCta>
    </div>
  );
}
