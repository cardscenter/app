import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Newspaper, Pin } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { listPublishedNews } from "@/lib/community/news";
import { formatEventDate } from "@/lib/shop-events/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "community" });
  return { title: `${t("newsTitle")} | Cards Center`, description: t("newsMeta") };
}

/** Nieuws van de winkel: gepubliceerde berichten, vastgepind bovenaan. */
export default async function NewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("community");
  const posts = await listPublishedNews();

  return (
    <PageContainer width="default" className="py-8 sm:py-10">
      <div className="max-w-2xl">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
          <Newspaper className="size-3.5" /> Cards Center Hulst
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{t("newsTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("newsIntro")}</p>
      </div>

      {posts.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">{t("noNews")}</p>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <Link key={p.id} href={`/nieuws/${p.slug}`} className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-shadow hover:shadow-card-hover">
              {p.coverImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.coverImage} alt="" className="aspect-[16/9] w-full object-cover" />
              ) : (
                <div className="flex aspect-[16/9] w-full items-center justify-center bg-muted text-muted-foreground">
                  <Newspaper className="size-8" />
                </div>
              )}
              <div className="flex flex-1 flex-col p-4">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  {p.publishedAt ? formatEventDate(new Date(p.publishedAt), locale) : ""}
                  {p.pinned && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                      <Pin className="size-3" /> {t("pinned")}
                    </span>
                  )}
                </p>
                <h2 className="mt-1.5 text-lg font-semibold leading-snug group-hover:underline">{p.title}</h2>
                {p.excerpt && <p className="mt-1.5 line-clamp-3 text-sm text-muted-foreground">{p.excerpt}</p>}
                <span className="mt-auto pt-3 text-sm font-medium text-primary">{t("readMore")}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
