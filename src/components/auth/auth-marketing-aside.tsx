import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ShieldCheck, Coins, MessageSquare, Globe2 } from "lucide-react";

interface AuthMarketingAsideProps {
  variant?: "login" | "register" | "default";
}

/**
 * Marketing-aside voor auth-pages (Fase 37). Toont logo/tagline, 4 trust-pills
 * en een stat-strip met live platform-cijfers. Op mobiel verborgen (alleen lg+)
 * zodat de form-side de volledige breedte krijgt.
 *
 * Variants:
 * - "login"   → "welkom terug"-toon
 * - "register" → "kom erbij"-toon met conversie-focus
 * - "default" → generieke versie voor forgot-password / verify-email
 */
export async function AuthMarketingAside({ variant = "default" }: AuthMarketingAsideProps) {
  const t = await getTranslations("auth");

  const eyebrow =
    variant === "login"
      ? null
      : variant === "register"
        ? t("asideRegisterEyebrow")
        : t("asideDefaultEyebrow");

  const title =
    variant === "login"
      ? t("asideLoginTitle")
      : variant === "register"
        ? t("asideRegisterTitle")
        : t("asideDefaultTitle");

  const subtitle =
    variant === "login"
      ? t("asideLoginSubtitle")
      : variant === "register"
        ? t("asideRegisterSubtitle")
        : t("asideDefaultSubtitle");

  const pills = [
    { Icon: ShieldCheck, titleKey: "asidePillEscrowTitle", descKey: "asidePillEscrowDesc", color: "emerald" },
    { Icon: Coins, titleKey: "asidePillRealBidsTitle", descKey: "asidePillRealBidsDesc", color: "teal" },
    { Icon: MessageSquare, titleKey: "asidePillSupportTitle", descKey: "asidePillSupportDesc", color: "sky" },
    { Icon: Globe2, titleKey: "asidePillGdprTitle", descKey: "asidePillGdprDesc", color: "violet" },
  ] as const;

  return (
    <aside className="relative hidden overflow-hidden bg-slate-950 text-white lg:flex lg:flex-col">
      {/* Dark gradient + ambient glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 100% 0%, rgba(59, 130, 246, 0.18), transparent 60%), radial-gradient(ellipse 60% 50% at 0% 100%, rgba(139, 92, 246, 0.14), transparent 60%)",
        }}
      />

      <div className="relative flex flex-1 flex-col justify-center gap-10 px-10 py-12 xl:px-16 xl:py-16">
        {/* Header — logo + eyebrow */}
        <div>
          <Image
            src="/images/logo-dark-mode.png"
            alt="Cards Center"
            width={520}
            height={140}
            priority
            className="h-20 w-auto xl:h-24"
          />
          {eyebrow && (
            <div className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white/80 ring-1 ring-white/20">
              {eyebrow}
            </div>
          )}
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white xl:text-5xl">
            {title}
          </h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-slate-300 xl:text-base">
            {subtitle}
          </p>
        </div>

        {/* Trust-pills grid */}
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 xl:gap-4">
          {pills.map((p) => (
            <div
              key={p.titleKey}
              className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
            >
              <div className={`inline-flex size-9 items-center justify-center rounded-lg ${iconBgFor(p.color)}`}>
                <p.Icon className="size-4" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-white">{t(p.titleKey)}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{t(p.descKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function iconBgFor(color: "emerald" | "teal" | "sky" | "violet"): string {
  switch (color) {
    case "emerald":
      return "bg-emerald-500/20 text-emerald-300";
    case "teal":
      return "bg-teal-500/20 text-teal-300";
    case "sky":
      return "bg-sky-500/20 text-sky-300";
    case "violet":
      return "bg-violet-500/20 text-violet-300";
  }
}
