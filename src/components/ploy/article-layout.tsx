import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { DisplayHeading } from "./display-heading";

/**
 * Artikel-layout (nieuws, juridische teksten): terug-link, meta-regel met
 * pillen, grote display-kop, intro, optionele omslag op volle breedte en een
 * proza-kolom van 42rem in Geist. `after` komt onder het artikel (verwante
 * kaarten, acties) op de volle inhoudsbreedte.
 */
export function ArticleLayout({
  back,
  meta,
  title,
  lead,
  cover,
  children,
  after,
  className = "",
}: {
  back?: { href: string; label: string };
  meta?: ReactNode;
  title: string;
  lead?: ReactNode;
  cover?: { src: string; alt?: string } | null;
  children: ReactNode;
  after?: ReactNode;
  className?: string;
}) {
  return (
    <article className={`flex justify-center px-4 pb-12 pt-4 sm:px-5 lg:px-6 lg:pb-16 lg:pt-8 ${className}`}>
      <div className="w-full max-w-6xl">
        {back && (
          <Link href={back.href} className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--foreground)]/55 no-underline transition-colors hover:text-[var(--foreground)]">
            <ChevronLeft className="size-4" /> {back.label}
          </Link>
        )}
        <header className="mx-auto mt-6 flex max-w-[52rem] flex-col items-center gap-5 text-center lg:mt-8">
          {meta && <div className="flex flex-wrap items-center justify-center gap-2">{meta}</div>}
          <DisplayHeading tag="h1" size={3} text={title} className="text-center" />
          {lead && <div className="cc-prose max-w-[38rem] text-lg lg:text-xl">{lead}</div>}
        </header>
        {cover && (
          <div className="mt-10 overflow-hidden rounded-[var(--radius-panel)] bg-white lg:mt-14">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover.src} alt={cover.alt ?? ""} className="aspect-[2/1] w-full object-cover" />
          </div>
        )}
        <div className="mx-auto mt-10 max-w-[42rem] space-y-5 text-[17px] leading-[1.65] text-[var(--foreground)]/85 lg:mt-14">{children}</div>
        {after && <div className="mt-16 lg:mt-24">{after}</div>}
      </div>
    </article>
  );
}
