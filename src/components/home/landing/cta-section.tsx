"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { DisplayHeading } from "@/components/ploy/display-heading";
import { CtaButton } from "@/components/ploy/cta-button";

/**
 * Afsluitende oproep: enorme kop, korte zin en een witte punch-card met een
 * e-mailveld dat naar de registratie leidt (het adres wordt vooringevuld).
 */
export function CtaSection({ title, description, placeholder, buttonLabel, reassurance, loggedIn, dashboardLabel }: { title: string; description: string; placeholder: string; buttonLabel: string; reassurance: string; loggedIn: boolean; dashboardLabel: string }) {
  const router = useRouter();
  return (
    <div id="account" className="flex justify-center px-4 pb-24 sm:px-5 lg:px-6 lg:pb-32">
      <div className="flex w-full max-w-6xl flex-col items-center gap-10 lg:gap-12">
        <div className="flex w-full flex-col items-center gap-7 text-center">
          <DisplayHeading tag="h2" size={1} text={title} scrollFill className="mx-auto max-w-[1040px] text-center" />
          <p className="cc-prose max-w-[32rem] text-base">{description}</p>
        </div>
        <div className="cc-punch relative flex w-full max-w-[36rem] flex-col items-center gap-6 rounded-[6px] bg-white px-6 pb-12 pt-11" style={{ "--cc-dot": "var(--cc-border)" } as React.CSSProperties}>
          <span className="cc-punch-dots" aria-hidden />
          {loggedIn ? (
            <CtaButton href="/dashboard" variant="dark">
              {dashboardLabel}
            </CtaButton>
          ) : (
            <form
              className="flex w-full items-center gap-2 rounded-full border border-[var(--cc-ink)]/15 bg-[var(--cc-bg)] p-1.5 shadow-[0_8px_28px_-12px_rgba(20,20,20,0.1)] max-[540px]:flex-col max-[540px]:rounded-[16px] max-[540px]:p-3"
              onSubmit={(e) => {
                e.preventDefault();
                const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
                router.push(email ? `/register?email=${encodeURIComponent(email)}` : "/register");
              }}
            >
              <input type="email" name="email" required placeholder={placeholder} className="min-w-0 flex-1 bg-transparent px-4 py-2 text-[15px] text-[var(--cc-ink)] outline-none placeholder:text-[var(--cc-ink)]/40 max-[540px]:w-full max-[540px]:text-center" />
              <button type="submit" className="cc-pill inline-flex items-center justify-center gap-1.5 bg-[var(--cc-red)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--cc-red-mid)] max-[540px]:w-full">
                {buttonLabel} <ArrowRight className="size-3.5" strokeWidth={2.4} />
              </button>
            </form>
          )}
          <p className="text-center text-sm font-semibold text-[var(--cc-ink)]/55">{reassurance}</p>
        </div>
      </div>
    </div>
  );
}
