import { Newspaper, Pin } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PunchCard } from "@/components/ploy/punch-card";
import { Pill } from "@/components/ploy/pill";
import type { NewsListItem } from "@/lib/community/news";
import { formatEventDateShort } from "@/lib/shop-events/format";

const PLACEHOLDER = ["var(--pastel-pink)", "var(--pastel-yellow)", "var(--pastel-blue)", "var(--pastel-green)"] as const;

/**
 * Nieuwskaart (design-pass): punch-card met omslag (of een pastelvlak met
 * krantje), datum- en vastgepind-pil, titel, samenvatting en "Lees verder".
 * `featured` maakt er een brede kaart van met de omslag links.
 */
export function NewsCard({ post, locale, index = 0, featured = false, labels }: { post: NewsListItem; locale: string; index?: number; featured?: boolean; labels: { pinned: string; readMore: string } }) {
  const date = post.publishedAt ? formatEventDateShort(new Date(post.publishedAt), locale) : "";
  const cover = post.coverImage ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={post.coverImage} alt="" className={`h-full w-full object-cover ${featured ? "min-h-[260px] lg:min-h-[420px]" : "aspect-[16/9]"}`} />
  ) : (
    <div className={`flex h-full w-full items-center justify-center ${featured ? "min-h-[220px] lg:min-h-[420px]" : "aspect-[16/9]"}`} style={{ background: PLACEHOLDER[index % PLACEHOLDER.length] }}>
      <Newspaper className="size-10 text-[var(--foreground)]/35" strokeWidth={1.5} />
    </div>
  );
  return (
    <Link href={`/nieuws/${post.slug}`} className="group block h-full no-underline">
      <PunchCard className="h-full overflow-hidden bg-white transition-[transform,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_18px_40px_-24px_rgba(32,32,32,0.35)]" dot="var(--border)">
        {/* Eigen wrapper: de stippen-span van PunchCard mag geen grid-cel innemen. */}
        <div className={`h-full ${featured ? "grid lg:grid-cols-2" : "flex flex-col"}`}>
          <div className={featured ? "overflow-hidden" : "overflow-hidden rounded-t-[6px]"}>{cover}</div>
          <div className={`flex flex-1 flex-col ${featured ? "justify-center p-6 sm:p-8 lg:p-10" : "p-6"}`}>
            <div className="flex flex-wrap items-center gap-2">
              {date && <Pill tone="pastel" color="blue">{date}</Pill>}
              {post.pinned && (
                <Pill color="yellow">
                  <Pin className="size-3" /> {labels.pinned}
                </Pill>
              )}
            </div>
            <h2 className={`mt-4 font-semibold leading-[1.15] tracking-[-0.03em] text-[var(--foreground)] ${featured ? "text-[28px] md:text-[36px] lg:text-[44px]" : "text-xl"}`}>{post.title}</h2>
            {post.excerpt && <p className={`cc-prose mt-3 ${featured ? "text-base lg:text-lg" : "line-clamp-3 text-sm"}`}>{post.excerpt}</p>}
            <span className={`text-sm font-semibold text-[var(--primary)] ${featured ? "mt-6" : "mt-auto pt-6"}`}>{labels.readMore} →</span>
          </div>
        </div>
      </PunchCard>
    </Link>
  );
}
