import { useTranslations } from "next-intl";
import { StaggerContainer, StaggerItem } from "@/components/home/animated-section";

export function HowItWorksSection() {
  const t = useTranslations("home");

  const steps = [
    { num: "1", title: t("step1Title"), desc: t("step1Desc") },
    { num: "2", title: t("step2Title"), desc: t("step2Desc") },
    { num: "3", title: t("step3Title"), desc: t("step3Desc") },
  ];

  return (
    <section className="py-14 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-bold text-foreground">{t("howItWorks")}</h2>
        <StaggerContainer className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3" staggerDelay={0.15}>
          {steps.map((step) => (
            <StaggerItem key={step.num}>
              <div className="glass rounded-2xl p-6 text-center h-full transition-all hover:shadow-lg">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  {step.num}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.desc}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
