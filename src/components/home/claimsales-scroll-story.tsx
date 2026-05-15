"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ArrowRight, Check, Tag } from "lucide-react";
import { Link } from "@/i18n/navigation";

/**
 * Scroll-pinned storytelling sectie voor claimsales — 3 stappen.
 *
 * Sectie is 200vh hoog. Sticky-frame (100vh) blijft in beeld terwijl de
 * gebruiker de tweede 100vh scrollt. Header staat IN het sticky-frame,
 * dus blijft tijdens de hele animatie bovenaan zichtbaar.
 *
 * Cross-fade boundaries:
 *  - Chapter 1 → 2 tussen 30% en 45% scroll-progress
 *  - Chapter 2 → 3 tussen 55% en 70% scroll-progress
 *
 * Layout:
 *  - Desktop (lg+): image links (col-6), text rechts (col-5), col-12 leeg
 *  - Mobile (<lg): zelfde sticky-pin, gestackt — image boven, text onder
 */

const IMAGE_PREVIEW = "/images/auction-preview.png"; // stap 1
const IMAGE_LISTING = "/images/claimsales-claim.png"; // stap 2
const IMAGE_DASHBOARD = "/images/claimsales-sale.png"; // stap 3

const CHAPTERS = [
  {
    labelKey: "claimsalesChapter1Label",
    titleKey: "claimsalesChapter1Title",
    descKey: "claimsalesChapter1Desc",
    bulletKeys: [
      "claimsalesChapter1Bullet1",
      "claimsalesChapter1Bullet2",
      "claimsalesChapter1Bullet3",
      "claimsalesChapter1Bullet4",
    ],
  },
  {
    labelKey: "claimsalesChapter2Label",
    titleKey: "claimsalesChapter2Title",
    descKey: "claimsalesChapter2Desc",
    bulletKeys: [
      "claimsalesChapter2Bullet1",
      "claimsalesChapter2Bullet2",
      "claimsalesChapter2Bullet3",
      "claimsalesChapter2Bullet4",
    ],
  },
  {
    labelKey: "claimsalesChapter3Label",
    titleKey: "claimsalesChapter3Title",
    descKey: "claimsalesChapter3Desc",
    bulletKeys: [
      "claimsalesChapter3Bullet1",
      "claimsalesChapter3Bullet2",
      "claimsalesChapter3Bullet3",
      "claimsalesChapter3Bullet4",
    ],
  },
] as const;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Linear tween: 0 als p ≤ a, 1 als p ≥ b, lineair ertussen. */
function tween(p: number, a: number, b: number): number {
  if (p <= a) return 0;
  if (p >= b) return 1;
  return (p - a) / (b - a);
}

export function ClaimsalesScrollStory() {
  const t = useTranslations("home");
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function update() {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      if (total <= 0) {
        setProgress(0);
        return;
      }
      setProgress(clamp01(-rect.top / total));
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  // Cross-fade transitions tussen chapters — kortere fade-windows (5%)
  // zodat de wissel snappier voelt en chapters meer fully-visible tijd hebben.
  const t12 = tween(progress, 0.31, 0.36);
  const t23 = tween(progress, 0.64, 0.69);

  // Per-chapter opacity (sluit logisch op 0/1)
  const ch1Op = 1 - t12;
  const ch2Op = t12 - t23;
  const ch3Op = t23;

  // Progress-bar segmenten (elk 1/3 van scroll)
  const seg1Pct = clamp01(progress / (1 / 3)) * 100;
  const seg2Pct = clamp01((progress - 1 / 3) / (1 / 3)) * 100;
  const seg3Pct = clamp01((progress - 2 / 3) / (1 / 3)) * 100;

  const alts = {
    preview: t("claimsalesStoryImageAltPreview"),
    listing: t("claimsalesStoryImageAltListing"),
    dashboard: t("claimsalesStoryImageAlt"),
  };

  return (
    <section className="bg-background">
      {/* Header — scrolt normaal boven de sticky scroll-story */}
      <div className="mx-auto max-w-[1680px] px-4 pt-20 sm:px-6 lg:px-8 lg:pt-24 xl:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30">
            <Tag className="size-3" />
            {t("claimsalesStoryEyebrow")}
          </span>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            {t("claimsalesStoryTitle")}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            {t("claimsalesStorySubtitle")}
          </p>
        </div>
      </div>

      <div ref={ref} className="relative h-[400vh]">
        <div className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden">
          <div className="mx-auto w-full max-w-[1680px] px-4 sm:px-6 lg:px-8 xl:px-10">
            {/* Desktop: 2-koloms (image links, text rechts), col-12 leeg */}
            <div className="hidden grid-cols-12 items-center gap-8 lg:grid">
              <div className="col-span-6 flex justify-center">
                <ImageStack
                  ch1Op={ch1Op}
                  ch2Op={ch2Op}
                  ch3Op={ch3Op}
                  alts={alts}
                  className="relative h-[74vh]"
                />
              </div>
              <div className="col-span-5">
                <div className="grid">
                  {CHAPTERS.map((chapter, idx) => (
                    <ChapterLayer
                      key={chapter.titleKey}
                      labelKey={chapter.labelKey}
                      titleKey={chapter.titleKey}
                      descKey={chapter.descKey}
                      bulletKeys={chapter.bulletKeys}
                      t={t}
                      opacity={[ch1Op, ch2Op, ch3Op][idx]!}
                    />
                  ))}
                </div>
                <ProgressBar
                  segments={[seg1Pct, seg2Pct, seg3Pct]}
                  className="mt-8"
                />
              </div>
            </div>

            {/* Mobile: gestackt (image boven, text onder) */}
            <div className="block lg:hidden">
              <ImageStack
                ch1Op={ch1Op}
                ch2Op={ch2Op}
                ch3Op={ch3Op}
                alts={alts}
                className="relative mx-auto w-full max-w-[280px]"
              />
              <div className="mt-5 grid">
                {CHAPTERS.map((chapter, idx) => (
                  <ChapterLayer
                    key={chapter.titleKey}
                    labelKey={chapter.labelKey}
                    titleKey={chapter.titleKey}
                    descKey={chapter.descKey}
                    bulletKeys={chapter.bulletKeys}
                    t={t}
                    opacity={[ch1Op, ch2Op, ch3Op][idx]!}
                    compact
                  />
                ))}
              </div>
              <ProgressBar
                segments={[seg1Pct, seg2Pct, seg3Pct]}
                className="mt-3"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface Alts {
  preview: string;
  listing: string;
  dashboard: string;
}

function ImageStack({
  ch1Op,
  ch2Op,
  ch3Op,
  alts,
  className,
}: {
  ch1Op: number;
  ch2Op: number;
  ch3Op: number;
  alts: Alts;
  className: string;
}) {
  return (
    <div className={className} style={{ aspectRatio: "4 / 5" }}>
      <ImageLayer src={IMAGE_PREVIEW} alt={alts.preview} opacity={ch1Op} />
      <ImageLayer src={IMAGE_LISTING} alt={alts.listing} opacity={ch2Op} />
      <ImageLayer src={IMAGE_DASHBOARD} alt={alts.dashboard} opacity={ch3Op} />
    </div>
  );
}

function ImageLayer({
  src,
  alt,
  opacity,
}: {
  src: string;
  alt: string;
  opacity: number;
}) {
  return (
    <div
      className="absolute inset-0 transition-opacity duration-500 ease-out"
      style={{ opacity }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(min-width: 1024px) 50vw, 90vw"
        className="object-contain"
        priority={false}
      />
    </div>
  );
}

function ChapterLayer({
  labelKey,
  titleKey,
  descKey,
  bulletKeys,
  t,
  opacity,
  compact = false,
}: {
  labelKey: string;
  titleKey: string;
  descKey: string;
  bulletKeys: readonly string[];
  t: ReturnType<typeof useTranslations>;
  opacity: number;
  compact?: boolean;
}) {
  return (
    <div
      className="col-start-1 row-start-1 transition-opacity duration-500 ease-out"
      style={{ opacity }}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
        {t(labelKey)}
      </p>
      <h3
        className={
          compact
            ? "mt-2 text-lg font-semibold tracking-tight text-foreground"
            : "mt-3 text-2xl font-semibold tracking-tight text-foreground lg:text-3xl"
        }
      >
        {t(titleKey)}
      </h3>
      <p
        className={
          compact
            ? "mt-2 text-sm leading-relaxed text-muted-foreground"
            : "mt-3 text-base leading-relaxed text-muted-foreground"
        }
      >
        {t(descKey)}
      </p>

      {/* Bullets met check-icon */}
      <ul className={compact ? "mt-3 space-y-1.5" : "mt-4 space-y-2"}>
        {bulletKeys.map((key) => (
          <li
            key={key}
            className={
              compact
                ? "flex items-start gap-2 text-[13px] leading-snug text-foreground/90"
                : "flex items-start gap-2.5 text-sm leading-snug text-foreground/90"
            }
          >
            <span
              className={
                compact
                  ? "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                  : "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
              }
            >
              <Check className={compact ? "size-2.5" : "size-3"} strokeWidth={3} />
            </span>
            <span>{t(key)}</span>
          </li>
        ))}
      </ul>

      {/* CTA — naar registratie */}
      <Link
        href="/register"
        className={
          compact
            ? "mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover"
            : "mt-5 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20 transition-colors hover:bg-primary-hover"
        }
      >
        {t("claimsalesStoryCta")}
        <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}

function ProgressBar({
  segments,
  className,
}: {
  segments: number[];
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      {segments.map((fillPct, i) => (
        <ProgressSegment key={i} fillPct={fillPct} />
      ))}
    </div>
  );
}

function ProgressSegment({ fillPct }: { fillPct: number }) {
  return (
    <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-amber-100 dark:bg-amber-500/20">
      <div
        className="absolute inset-y-0 left-0 bg-amber-500 transition-[width] duration-200 dark:bg-amber-400"
        style={{ width: `${fillPct}%` }}
      />
    </div>
  );
}
