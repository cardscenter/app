"use client";

import { motion } from "framer-motion";
import { Link } from "@/i18n/navigation";

export interface FooterColumn {
  title: string;
  links: { label: string; href: string; external?: boolean }[];
}

/**
 * Donkere footer: groot wit logo dat in beeld veert, slagzin, contact-link,
 * kolommen met links en de juridische onderbalk.
 */
export function LandingFooter({ tagline, contactLabel, contactHref, columns, legal, copyright }: { tagline: string; contactLabel: string; contactHref: string; columns: FooterColumn[]; legal: { label: string; href: string }[]; copyright: string }) {
  return (
    <footer className="px-0 pb-0 sm:px-5 lg:px-6">
      <div className="rounded-t-[20px] bg-[var(--cc-ink)] px-5 pb-10 pt-16 text-white sm:px-8 lg:px-12 lg:pt-20">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 lg:gap-[76px]">
          <motion.div
            className="mx-auto w-[92%] max-w-5xl"
            initial={{ scale: 0, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: [0.34, 1.56, 0.64, 1] }}
            aria-hidden
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo-dark-mode.png" alt="" className="w-full" />
          </motion.div>
          <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-start">
            <p className="max-w-[24rem] text-base text-white/65">{tagline}</p>
            <a href={contactHref} className="flex items-center gap-2 text-xl text-white no-underline hover:underline sm:text-2xl">
              → {contactLabel}
            </a>
          </div>
          <div className="grid w-full grid-cols-2 gap-x-8 gap-y-10 border-t border-white/15 pt-10 md:grid-cols-4">
            {columns.map((c) => (
              <div key={c.title} className="flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-white/65">{c.title}</h3>
                <ul className="flex flex-col gap-3">
                  {c.links.map((l) => (
                    <li key={l.label}>
                      {l.external ? (
                        <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-base text-white/85 no-underline hover:text-white">
                          {l.label}
                        </a>
                      ) : (
                        <Link href={l.href} className="text-base text-white/85 no-underline hover:text-white">
                          {l.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/15 pt-6 text-sm text-white/65">
            <span>{copyright}</span>
            {legal.map((l) => (
              <Link key={l.href} href={l.href} className="no-underline hover:text-white">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
