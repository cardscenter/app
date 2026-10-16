import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { getPublishedNews } from "@/lib/community/news";
import { toParagraphs } from "@/lib/community/config";
import { formatEventDate } from "@/lib/shop-events/format";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedNews(slug);
  if (!post) return { title: "Cards Center" };
  return { title: `${post.title} | Cards Center`, description: post.excerpt ?? post.body.slice(0, 160) };
}

export default async function NewsPostPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("community");
  const post = await getPublishedNews(slug);
  if (!post) notFound();

  return (
    <PageContainer width="narrow" className="py-8 sm:py-10">
      <Link href="/nieuws" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> {t("backToNews")}
      </Link>
      <article className="mt-4">
        <p className="text-xs text-muted-foreground">
          {post.publishedAt ? formatEventDate(post.publishedAt, locale) : ""} · {post.author.displayName}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{post.title}</h1>
        {post.excerpt && <p className="mt-3 text-lg text-muted-foreground">{post.excerpt}</p>}
        {post.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.coverImage} alt="" className="mt-6 w-full rounded-2xl border border-border object-cover" />
        )}
        <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-foreground/90">
          {toParagraphs(post.body).map((p, i) => (
            <p key={i} className="whitespace-pre-line">
              {p}
            </p>
          ))}
        </div>
      </article>
    </PageContainer>
  );
}
