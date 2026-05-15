import { useTranslations } from "next-intl";
import { ShieldCheck, BadgeCheck, Clock, MessageSquare, Coins } from "lucide-react";
import { StaggerContainer, StaggerItem } from "@/components/home/animated-section";

const PILLARS = [
  {
    Icon: ShieldCheck,
    titleKey: "pillarEscrowTitle",
    descKey: "pillarEscrowDesc",
    iconBg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    accent: "from-emerald-400/20 via-emerald-400/5 to-transparent dark:from-emerald-500/25 dark:via-emerald-500/10",
    ring: "ring-emerald-200 dark:ring-emerald-500/30",
  },
  {
    Icon: Coins,
    titleKey: "pillarRealBidsTitle",
    descKey: "pillarRealBidsDesc",
    iconBg: "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300",
    accent: "from-teal-400/20 via-teal-400/5 to-transparent dark:from-teal-500/25 dark:via-teal-500/10",
    ring: "ring-teal-200 dark:ring-teal-500/30",
  },
  {
    Icon: BadgeCheck,
    titleKey: "pillarVerificationTitle",
    descKey: "pillarVerificationDesc",
    iconBg: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
    accent: "from-sky-400/20 via-sky-400/5 to-transparent dark:from-sky-500/25 dark:via-sky-500/10",
    ring: "ring-sky-200 dark:ring-sky-500/30",
  },
  {
    Icon: Clock,
    titleKey: "pillarAntiSnipeTitle",
    descKey: "pillarAntiSnipeDesc",
    iconBg: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    accent: "from-amber-400/20 via-amber-400/5 to-transparent dark:from-amber-500/25 dark:via-amber-500/10",
    ring: "ring-amber-200 dark:ring-amber-500/30",
  },
  {
    Icon: MessageSquare,
    titleKey: "pillarSupportTitle",
    descKey: "pillarSupportDesc",
    iconBg: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
    accent: "from-violet-400/20 via-violet-400/5 to-transparent dark:from-violet-500/25 dark:via-violet-500/10",
    ring: "ring-violet-200 dark:ring-violet-500/30",
  },
] as const;

export function TrustPillarsSection() {
  const t = useTranslations("home");

  return (
    <section className="bg-background py-16 lg:py-24">
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {t("trustPillarsTitle")}
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            {t("trustPillarsSubtitle")}
          </p>
        </div>

        <StaggerContainer
          className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5"
          staggerDelay={0.08}
        >
          {PILLARS.map((pillar) => (
            <StaggerItem key={pillar.titleKey}>
              <div className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-card ring-1 ${pillar.ring} transition-shadow hover:shadow-card-hover`}>
                {/* Colored radial glow accent — Tailwind gradient-stop utilities zetten
                    --tw-gradient-stops; de inline style consumeert die in een radial-gradient. */}
                <div
                  aria-hidden
                  className={`pointer-events-none absolute -right-12 -top-12 size-40 rounded-full ${pillar.accent} opacity-70 blur-2xl`}
                  style={{
                    backgroundImage: `radial-gradient(circle, var(--tw-gradient-stops))`,
                  }}
                />
                <div className="relative">
                  <div className={`inline-flex size-12 items-center justify-center rounded-xl ${pillar.iconBg} transition-transform group-hover:scale-110`}>
                    <pillar.Icon className="size-6" />
                  </div>
                  <h3 className="mt-5 text-base font-semibold text-foreground">
                    {t(pillar.titleKey)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {t(pillar.descKey)}
                  </p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
