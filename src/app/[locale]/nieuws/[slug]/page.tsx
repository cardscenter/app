import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Pin } from "lucide-react";
import { getPublishedNews, listPublishedNews } from "@/lib/community/news";
import { toParagraphs } from "@/lib/community/config";
import { formatEventDate } from "@/lib/shop-events/format";
import { ArticleLayout } from "@/components/ploy/article-layout";
import { Pill } from "@/components/ploy/pill";
import { SectionHead } from "@/components/ploy/section-head";
import { CtaButton } from "@/components/ploy/cta-button";
import { NewsCard } from "@/components/community/news-card";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedNews(slug);
  if (!post) return { title: "Cards Center" };
  return { title: `${post.title} | Cards Center`, description: post.excerpt ?? post.body.slice(0, 160) };
}

/** Nieuwsbericht (design-pass Fase C): artikel-layout met verwante berichten eronder. */
export default async function NewsPostPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const [t, post] = await Promise.all([getTranslations("community"), getPublishedNews(slug)]);
  if (!post) notFound();
  const related = (await listPublishedNews(4)).filter((p) => p.slug !== post.slug).slice(0, 3);
  const labels = { pinned: t("pinned"), readMore: t("readMore") };

  return (
    <div className="cc-landing overflow-clip">
      <ArticleLayout
        back={{ href: "/nieuws", label: t("backToNews") }}
        meta={
          <>
            {post.publishedAt && <Pill tone="white">{formatEventDate(post.publishedAt, locale)}</Pill>}
            <Pill tone="white">{post.author.displayName}</Pill>
            {post.pinned && (
              <Pill color="yellow">
                <Pin className="size-3" /> {t("pinned")}
              </Pill>
            )}
          </>
        }
        title={post.title}
        lead={post.excerpt}
        cover={post.coverImage ? { src: post.coverImage } : null}
        after={
          related.length > 0 ? (
            <>
              <SectionHead eyebrow={t("newsEyebrow")} eyebrowColor="pink" title={t("moreNews")} action={<CtaButton href="/nieuws" variant="light">{t("allNews")}</CtaButton>} size={4} />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((p, i) => (
                  <NewsCard key={p.id} post={p} locale={locale} index={i} labels={labels} />
                ))}
              </div>
            </>
          ) : undefined
        }
      >
        {toParagraphs(post.body).map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        ))}
      </ArticleLayout>
    </div>
  );
}
