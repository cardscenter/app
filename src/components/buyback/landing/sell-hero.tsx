import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Check } from "lucide-react";
import {
  BUYBACK_ERA_START,
  BUYBACK_RATE,
  MAX_BUYBACK_MARKTPRIJS,
  MINIMUM_BULK_VALUE,
  MINIMUM_COLLECTION_VALUE,
  STORE_CREDIT_BONUS,
} from "@/lib/buyback-pricing";
import { formatCurrency } from "@/lib/format";
import { CenteredHero } from "@/components/ploy/centered-hero";
import { CtaButton } from "@/components/ploy/cta-button";
import { Pill } from "@/components/ploy/pill";
import { TileQuad, type TileItem } from "@/components/ploy/tile-quad";

// Hero + keuzetegels van /verkopen (verkopen AAN Cards Center). Alle
// bedragen/percentages komen uit buyback-pricing — nooit hardcoded in copy.

export const RATE_LABEL = `${Math.round(BUYBACK_RATE * 100)}%`;
export const BONUS_LABEL = `${Math.round(STORE_CREDIT_BONUS * 100)}%`;

export function currencyLocale(locale: string): string {
  return locale === "en" ? "en-GB" : "nl-NL";
}

/** Hero (design-pass): eyebrow, display-kop met veegstreep, tekst, twee knoppen en feiten-pillen. */
export async function SellHero() {
  const t = await getTranslations("buyback");
  const stats = [t("landing.statRate", { rate: RATE_LABEL }), t("landing.statPayout"), t("landing.statBankOnly")];
  return (
    <CenteredHero eyebrow={t("landing.eyebrow")} eyebrowColor="yellow" title={t("landing.heroTitle")} highlightWord={t("landing.heroWord")} highlightColor="yellow" description={t("landing.heroSubtitle", { rate: RATE_LABEL })}>
      <CtaButton href="/verkopen/losse-kaarten" variant="red">
        {t("landing.ctaSingles")}
      </CtaButton>
      <CtaButton href="/verkopen/bulk" variant="light">
        {t("landing.ctaBulk")}
      </CtaButton>
      <div className="mt-2 flex w-full flex-wrap items-center justify-center gap-2">
        {stats.map((s) => (
          <Pill key={s} tone="white">
            <Check className="size-3 text-[var(--primary)]" /> {s}
          </Pill>
        ))}
      </div>
    </CenteredHero>
  );
}

/** Keuzetegels: losse kaarten (roze) en bulk (geel) met de spelregels als lijst. */
export async function SellPaths() {
  const t = await getTranslations("buyback");
  const locale = await getLocale();
  const fmt = (n: number) => formatCurrency(n, currencyLocale(locale));

  const singlesBullets = [
    t("landing.singlesBullet1", { rate: RATE_LABEL }),
    t("landing.singlesBullet2", { min: fmt(MINIMUM_COLLECTION_VALUE) }),
    t("landing.singlesBullet3", { max: fmt(MAX_BUYBACK_MARKTPRIJS) }),
    t("landing.singlesBullet4", { year: BUYBACK_ERA_START.slice(0, 4) }),
    t("landing.singlesBullet5"),
  ];
  const bulkBullets = [t("landing.bulkBullet1"), t("landing.bulkBullet2", { min: fmt(MINIMUM_BULK_VALUE) }), t("landing.bulkBullet3"), t("landing.bulkBullet4")];

  const items: TileItem[] = [
    {
      title: t("landing.singlesCardTitle"),
      color: "pink",
      animation: "helix",
      text: (
        <>
          <p>{t("landing.singlesCardDesc")}</p>
          <Bullets items={singlesBullets} />
        </>
      ),
      action: <PathLink href="/verkopen/losse-kaarten" label={t("landing.ctaSingles")} />,
    },
    {
      title: t("landing.bulkCardTitle"),
      color: "yellow",
      animation: "rain",
      text: (
        <>
          <p>{t("landing.bulkCardDesc")}</p>
          <Bullets items={bulkBullets} />
        </>
      ),
      action: <PathLink href="/verkopen/bulk" label={t("landing.ctaBulk")} />,
    },
  ];

  return (
    <>
      <section className="flex justify-center px-4 pb-6 sm:px-5 lg:px-6">
        <div className="w-full max-w-6xl text-center">
          <h2 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.04em] text-[var(--foreground)] md:text-[36px]">{t("landing.pathsTitle")}</h2>
          <p className="cc-prose mx-auto mt-3 max-w-[36rem] text-base">{t("landing.pathsSubtitle")}</p>
        </div>
      </section>
      <TileQuad items={items} />
    </>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-1.5">
      {items.map((b) => (
        <li key={b} className="flex items-start gap-2 text-[var(--foreground)]/80">
          <Check className="mt-0.5 size-4 shrink-0 text-[var(--foreground)]" />
          <span>{b}</span>
        </li>
      ))}
    </ul>
  );
}

function PathLink({ href, label }: { href: "/verkopen/losse-kaarten" | "/verkopen/bulk"; label: string }) {
  return (
    <Link href={href} className="cc-pill inline-flex items-center gap-1.5 bg-[var(--foreground)] px-5 py-3 text-sm font-semibold leading-none text-white no-underline transition-colors hover:bg-[var(--foreground)]/85">
      {label} →
    </Link>
  );
}
