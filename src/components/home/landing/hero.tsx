"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { DisplayHeading } from "@/components/ploy/display-heading";
import { CtaButton } from "@/components/ploy/cta-button";
import { Balloon, type BalloonColor, type BalloonShape } from "@/components/ploy/balloon";

export interface HeroAnnouncement {
  kicker: string;
  title: string;
  href: string;
  image: string | null;
}

const BALLOONS: { color: BalloonColor; shape: BalloonShape; x: string; y: string; size: number; delay: number; dur: number }[] = [
  { color: "red", shape: "cloud", x: "6%", y: "12%", size: 300, delay: 0.1, dur: 9 },
  { color: "pink", shape: "stack", x: "72%", y: "8%", size: 240, delay: 0.3, dur: 11 },
  { color: "yellow", shape: "flower", x: "80%", y: "58%", size: 230, delay: 0.5, dur: 10 },
  { color: "blue", shape: "cloud", x: "14%", y: "62%", size: 210, delay: 0.7, dur: 12 },
];

/**
 * Hero van de nieuwe homepage: afgerond donker paneel (zoals de film-hero
 * in de referentie) met zwevende, sleepbare ballonnen, grote witte kop en
 * twee knoppen. `videoSrc` is voorbereid voor later: zodra er beeld van de
 * winkel is, speelt dat hier achter de tekst.
 */
export function LandingHero({
  eyebrow,
  title,
  subtitle,
  loggedIn,
  announcement,
  videoSrc,
  posterSrc,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  loggedIn: boolean;
  announcement: HeroAnnouncement | null;
  videoSrc?: string;
  posterSrc?: string;
}) {
  const t = useTranslations("home.landing");
  const panel = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  return (
    <section className="relative px-4 pb-4 pt-20 sm:px-5 sm:pt-[88px] lg:px-6" aria-labelledby="landing-hero-title">
      <div
        ref={panel}
        className="relative mx-auto flex h-[calc(100svh-7rem)] max-h-[1000px] min-h-[640px] w-full max-w-[2400px] items-center justify-center overflow-hidden rounded-[20px] bg-[var(--cc-dark)] text-white"
      >
        {/* Achtergrond: rode gloed uit de huisstijl, later eventueel video. */}
        {videoSrc ? (
          <video className="absolute inset-0 h-full w-full object-cover" src={videoSrc} poster={posterSrc} autoPlay muted loop playsInline />
        ) : (
          <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 60% at 30% 30%, rgba(197,26,37,0.55) 0%, rgba(140,20,32,0.25) 40%, rgba(22,9,11,0) 72%), radial-gradient(ellipse 50% 50% at 85% 80%, rgba(242,32,43,0.35) 0%, rgba(22,9,11,0) 70%)" }} />
        )}

        {/* Ballonnen: drijven en zijn sleepbaar binnen het paneel. */}
        <div className="absolute inset-0" aria-hidden>
          {BALLOONS.map((b, i) => (
            <motion.div
              key={b.color}
              className="absolute cursor-grab touch-none active:cursor-grabbing"
              style={{ left: b.x, top: b.y, width: `clamp(${Math.round(b.size * 0.45)}px, ${Math.round(b.size / 14)}vw, ${b.size}px)` }}
              initial={reduced ? false : { opacity: 0, y: 160, scale: 0.7 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.25 + b.delay, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              drag
              dragConstraints={panel}
              dragElastic={0.18}
              dragMomentum
              whileDrag={{ scale: 1.06 }}
            >
              <motion.div
                animate={reduced ? undefined : { y: [0, -16, 0], rotate: [-4 + i, 4 + i, -4 + i] }}
                transition={{ duration: b.dur, ease: "easeInOut", repeat: Infinity }}
              >
                <Balloon color={b.color} shape={b.shape} className="h-auto w-full drop-shadow-[0_30px_40px_rgba(0,0,0,0.35)]" />
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* Vignet voor leesbaarheid */}
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 58% at 50% 50%, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.34) 42%, rgba(0,0,0,0) 74%)" }} />

        {/* Inhoud */}
        <div className="pointer-events-none relative z-10 flex w-full max-w-[1100px] flex-col items-center gap-7 px-5 text-center">
          <p className="cc-intro inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/70" style={{ "--cc-intro-delay": "60ms" } as React.CSSProperties}>
            {eyebrow}
          </p>
          <div className="cc-intro w-full" style={{ "--cc-intro-delay": "140ms" } as React.CSSProperties}>
            <DisplayHeading tag="h1" size={1} id="landing-hero-title" text={title} className="mx-auto text-white" />
          </div>
          <p className="cc-intro max-w-[30rem] text-base text-white/80 sm:text-lg" style={{ "--cc-intro-delay": "240ms" } as React.CSSProperties}>
            {subtitle}
          </p>
          <div className="cc-intro pointer-events-auto flex flex-wrap items-center justify-center gap-3" style={{ "--cc-intro-delay": "340ms" } as React.CSSProperties}>
            {loggedIn ? (
              <CtaButton href="/dashboard" variant="light">
                {t("heroCtaDashboard")}
              </CtaButton>
            ) : (
              <CtaButton href="/register" variant="light">
                {t("heroCtaRegister")}
              </CtaButton>
            )}
            <CtaButton href="/evenementen" variant="ghost" icon={<CalendarDays className="size-4" />}>
              {t("heroCtaEvents")}
            </CtaButton>
          </div>
        </div>

        {/* Aankondiging linksonder: het laatste nieuwsbericht. */}
        {announcement && (
          <Link
            href={announcement.href}
            className="group absolute bottom-4 left-4 z-20 flex w-[min(360px,calc(100%-2rem))] items-center gap-4 rounded-[10px] bg-white/95 p-3 pr-5 text-[var(--cc-ink)] no-underline shadow-[0_18px_50px_-12px_rgba(0,0,0,0.55)] backdrop-blur-md transition-[background-color,box-shadow] duration-300 hover:bg-white lg:bottom-6 lg:left-6"
          >
            {announcement.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={announcement.image} alt="" className="size-[58px] shrink-0 rounded-[6px] object-cover" />
            ) : (
              <span className="flex size-[58px] shrink-0 items-center justify-center rounded-[6px] bg-[var(--cc-red-soft)] text-[var(--cc-red)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/logo-white-bg.png" alt="" className="h-5 w-auto" />
              </span>
            )}
            <span className="flex min-w-0 flex-col">
              <span className="text-[11px] font-semibold uppercase leading-none tracking-[0.08em] text-[var(--cc-ink)]/50">{announcement.kicker}</span>
              <span className="mt-1 flex items-start gap-1.5 text-sm font-semibold leading-[1.15] tracking-[-0.01em]">
                <span className="line-clamp-2">{announcement.title}</span>
                <ArrowUpRight className="mt-px size-3.5 shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </span>
            </span>
          </Link>
        )}
      </div>
    </section>
  );
}
