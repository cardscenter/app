import { useTranslations } from "next-intl";
import { ShieldCheck, BadgeCheck, Clock, MessageSquare, Coins } from "lucide-react";
import { StaggerContainer, StaggerItem } from "@/components/home/animated-section";

const PILLARS = [
  {
    Icon: ShieldCheck,
    titleKey: "pillarEscrowTitle",
    descKey: "pillarEscrowDesc",
    iconBg: "bg-emerald-100 text-emerald-700",
    accent: "from-emerald-400/20 via-emerald-400/5 to-transparent",
    ring: "ring-emerald-200",
  },
  {
    Icon: Coins,
    titleKey: "pillarRealBidsTitle",
    descKey: "pillarRealBidsDesc",
    iconBg: "bg-teal-100 text-teal-700",
    accent: "from-teal-400/20 via-teal-400/5 to-transparent",
    ring: "ring-teal-200",
  },
  {
    Icon: BadgeCheck,
    titleKey: "pillarVerificationTitle",
    descKey: "pillarVerificationDesc",
    iconBg: "bg-sky-100 text-sky-700",
    accent: "from-sky-400/20 via-sky-400/5 to-transparent",
    ring: "ring-sky-200",
  },
  {
    Icon: Clock,
    titleKey: "pillarAntiSnipeTitle",
    descKey: "pillarAntiSnipeDesc",
    iconBg: "bg-amber-100 text-amber-700",
    accent: "from-amber-400/20 via-amber-400/5 to-transparent",
    ring: "ring-amber-200",
  },
  {
    Icon: MessageSquare,
    titleKey: "pillarSupportTitle",
    descKey: "pillarSupportDesc",
    iconBg: "bg-violet-100 text-violet-700",
    accent: "from-violet-400/20 via-violet-400/5 to-transparent",
    ring: "ring-violet-200",
  },
] as const;

export function TrustPillarsSection() {
  const t = useTranslations("home");

  return (
    <section className="bg-background py-16 lg:py-24">
      <div className="mx-auto max-w-[1880px] px-[clamp(1rem,3vw,4rem)]">
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
