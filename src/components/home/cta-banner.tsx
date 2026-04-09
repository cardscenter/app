import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";
import { AnimatedSection } from "@/components/home/animated-section";

export function CtaBanner() {
  const t = useTranslations("home");

  return (
    <section className="relative overflow-hidden bg-slate-900 py-14">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-amber-500/10 background-size-[200%_200%] animate-gradient-shift" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <AnimatedSection>
          <h2 className="text-2xl font-bold text-white sm:text-3xl">{t("ctaTitle")}</h2>
          <p className="mx-auto mt-3 max-w-md text-white/70">{t("ctaDesc")}</p>
          <Link
            href="/register"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-primary-hover hover:shadow-xl hover:scale-105"
          >
            {t("ctaButton")}
            <ArrowRight className="size-4" />
          </Link>
        </AnimatedSection>
      </div>
    </section>
  );
}
