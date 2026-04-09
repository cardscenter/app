import { useTranslations } from "next-intl";
import { Shield, Clock, Wallet, Star } from "lucide-react";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/home/animated-section";

export function FeaturesSection() {
  const t = useTranslations("home");

  const features = [
    { icon: Shield, title: t("featureSecure"), desc: t("featureSecureDesc"), color: "bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
    { icon: Clock, title: t("featureAntiSnipe"), desc: t("featureAntiSnipeDesc"), color: "bg-amber-50 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
    { icon: Wallet, title: t("featureWallet"), desc: t("featureWalletDesc"), color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
    { icon: Star, title: t("featureCommunity"), desc: t("featureCommunityDesc"), color: "bg-purple-50 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
  ];

  return (
    <section className="py-8 sm:py-14 border-t border-border section-gradient-alt">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <AnimatedSection>
          <h2 className="text-center text-2xl font-bold text-foreground">{t("whyCardsCenter")}</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">{t("whyCardsCenterDesc")}</p>
        </AnimatedSection>
        <StaggerContainer className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4" staggerDelay={0.12}>
          {features.map((f) => (
            <StaggerItem key={f.title}>
              <div className="glass rounded-2xl p-5 h-full transition-all hover:shadow-lg hover:scale-[1.02]">
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${f.color}`}>
                  <f.icon className="size-5" />
                </div>
                <h3 className="mt-4 font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
