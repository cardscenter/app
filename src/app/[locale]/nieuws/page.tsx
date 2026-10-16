import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { listPublishedNews } from "@/lib/community/news";
import { CenteredHero } from "@/components/ploy/centered-hero";
import { CatalogGrid } from "@/components/ploy/catalog-grid";
import { BannerPromo } from "@/components/ploy/banner-promo";
import { CtaButton } from "@/components/ploy/cta-button";
import { PunchCard } from "@/components/ploy/punch-card";
import { DisplayHeading } from "@/components/ploy/display-heading";
import { Balloon } from "@/components/ploy/balloon";
import { NewsCard } from "@/components/community/news-card";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "community" });
  return { title: `${t("newsTitle")} | Cards Center`, description: t("newsMeta") };
}

/**
 * Nieuws van de winkel (design-pass Fase C): hero, het eerste bericht als
 * brede kaart, de rest in een catalogus-grid, nieuwsbrief-strook onderaan.
 */
export default async function NewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, posts, session] = await Promise.all([getTranslations("community"), listPublishedNews(), auth()]);
  const viewerId = session?.user?.id ?? null;
  const [first, ...rest] = posts;
  const labels = { pinned: t("pinned"), readMore: t("readMore") };

  return (
    <div className="cc-landing overflow-clip">
      <CenteredHero eyebrow={t("newsEyebrow")} eyebrowColor="pink" title={t("newsHeroTitle")} highlightWord={t("newsHeroWord")} highlightColor="pink" description={t("newsIntro")} />

      {first && (
        <section className="flex justify-center px-4 pb-4 sm:px-5 lg:px-6">
          <div className="w-full max-w-6xl">
            <NewsCard post={first} locale={locale} featured labels={labels} />
          </div>
        </section>
      )}

      <CatalogGrid
        empty={
          <PunchCard className="relative overflow-hidden bg-white px-6 py-14 text-center sm:px-12" dot="var(--border)">
            <Balloon color="pink" shape="cloud" className="pointer-events-none absolute -right-8 -top-8 w-36 opacity-90" />
            <div className="relative mx-auto max-w-[30rem]">
              <DisplayHeading tag="h2" size={4} text={t("noNewsTitle")} className="text-center" />
              <p className="cc-prose mt-3 text-base">{t("noNews")}</p>
            </div>
          </PunchCard>
        }
      >
        {rest.map((p, i) => (
          <NewsCard key={p.id} post={p} locale={locale} index={i + 1} labels={labels} />
        ))}
      </CatalogGrid>

      <BannerPromo
        eyebrow={t("newsletterEyebrow")}
        title={t("newsletterTitle")}
        text={t("newsletterText")}
        note={t("newsletterNote")}
        action={
          <CtaButton href={viewerId ? "/dashboard/instellingen" : "/register"} variant="light">
            {viewerId ? t("newsletterCtaLogged") : t("newsletterCta")}
          </CtaButton>
        }
      />
    </div>
  );
}
