import { useTranslations } from "next-intl";
import { HelpCircle, ChevronDown, MessageSquare } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { AnimatedSection } from "@/components/home/animated-section";

// Support-mailto fallback tot /contact-route bestaat (Fase 36 follow-up).
const SUPPORT_EMAIL = "support@cardscenter.nl";

// Per FAQ-antwoord optioneel een dashboard-pad waar de inline <link>...</link>
// in de i18n-string naar wijst. Niet alle antwoorden hebben een link; voor
// items zonder linkPath rendert t.rich gewoon de plain string.
const FAQ_KEYS: ReadonlyArray<{ qKey: string; aKey: string; linkHref?: string }> = [
  { qKey: "faqQ1", aKey: "faqA1" },
  { qKey: "faqQ2", aKey: "faqA2" },
  { qKey: "faqQ3", aKey: "faqA3" },
  { qKey: "faqQ4", aKey: "faqA4" },
  { qKey: "faqQ5", aKey: "faqA5" },
  { qKey: "faqQ6", aKey: "faqA6" },
  { qKey: "faqQ7", aKey: "faqA7" },
  { qKey: "faqQ8", aKey: "faqA8" },
  { qKey: "faqQ9", aKey: "faqA9" },
  { qKey: "faqQ10", aKey: "faqA10", linkHref: "/dashboard/saldo" },
  { qKey: "faqQ11", aKey: "faqA11", linkHref: "/dashboard/uitbetalingen" },
  { qKey: "faqQ12", aKey: "faqA12", linkHref: "/dashboard/verzending" },
  { qKey: "faqQ13", aKey: "faqA13" },
];

export function FaqSection({ bgClass = "bg-background" }: { bgClass?: string }) {
  const t = useTranslations("home");

  return (
    <section className={`py-16 lg:py-24 ${bgClass}`}>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <AnimatedSection>
          {/* Header */}
          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-700 ring-1 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/30">
              <HelpCircle className="size-3" />
              {t("faqEyebrow")}
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {t("faqTitle")}
            </h2>
            <p className="mt-3 text-base text-muted-foreground">{t("faqSubtitle")}</p>
          </div>

          {/* Accordion */}
          <div className="mt-10 space-y-3">
            {FAQ_KEYS.map((faq) => (
              <details
                key={faq.qKey}
                className="group rounded-xl border border-border bg-card transition-colors open:shadow-card"
              >
                <summary
                  className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden"
                >
                  <span className="text-base font-semibold text-foreground">{t(faq.qKey)}</span>
                  <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-border px-5 py-4">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {faq.linkHref
                      ? t.rich(faq.aKey, {
                          link: (chunks) => (
                            <Link href={faq.linkHref!} className="font-medium text-primary underline-offset-2 hover:underline">
                              {chunks}
                            </Link>
                          ),
                        })
                      : t(faq.aKey)}
                  </p>
                </div>
              </details>
            ))}
          </div>

          {/* Support CTA */}
          <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center">
            <div className="mx-auto inline-flex size-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
              <MessageSquare className="size-5" />
            </div>
            <h3 className="mt-3 text-base font-semibold text-foreground">{t("faqSupportTitle")}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{t("faqSupportDesc")}</p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-sky-700 hover:text-sky-800 dark:text-sky-300 dark:hover:text-sky-200"
            >
              {t("faqSupportCta")}
              <ChevronDown className="size-4 -rotate-90" />
            </a>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
