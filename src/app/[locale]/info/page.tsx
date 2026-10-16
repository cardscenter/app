import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MapPin, Clock, Car, ScrollText, ExternalLink, CalendarDays, UtensilsCrossed, Mail } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { getHubSettings } from "@/lib/app-config";
import { toParagraphs } from "@/lib/community/config";
import { formatShopAddress, PLATFORM } from "@/lib/platform-config";

export const dynamic = "force-dynamic";

const WEBSITE = "https://cards-center.nl";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "community" });
  return { title: `${t("infoTitle")} | Cards Center`, description: t("infoMeta") };
}

/** Info-pagina: adres, openingstijden, bereikbaarheid, huisregels (teksten uit de hub-instellingen). */
export default async function InfoPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("community");
  const s = await getHubSettings();
  const address = formatShopAddress();
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${PLATFORM.shop.name}, ${address}`)}`;

  const Block = ({ icon: Icon, title, children, id }: { icon: typeof MapPin; title: string; children: React.ReactNode; id?: string }) => (
    <section id={id} className="dash-card p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Icon className="size-5 text-primary" /> {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-foreground/90">{children}</div>
    </section>
  );

  return (
    <PageContainer width="default" className="py-8 sm:py-10">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Cards Center Hulst</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{t("infoTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("infoIntro")}</p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Block icon={ScrollText} title={t("houseRules")} id="huisregels">
            <ol className="list-decimal space-y-2 pl-5">
              {toParagraphs(s.houseRules).map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          </Block>
          <Block icon={Car} title={t("directions")} id="bereikbaarheid">
            {toParagraphs(s.directions).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              <MapPin className="size-4" /> {t("planRoute")}
            </a>
          </Block>
        </div>

        <aside className="space-y-6">
          <Block icon={MapPin} title={t("address")}>
            <p>
              <strong>{PLATFORM.shop.name}</strong>
              <br />
              {address}
            </p>
            <a href={WEBSITE} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              <ExternalLink className="size-4" /> cards-center.nl
            </a>
            <p className="text-sm text-muted-foreground">
              <Mail className="mr-1 inline size-4 align-text-bottom" />
              <a href={`mailto:${PLATFORM.supportEmail}`} className="hover:underline">
                {PLATFORM.supportEmail}
              </a>
            </p>
          </Block>
          <Block icon={Clock} title={t("openingHours")}>
            <p className="whitespace-pre-line">{s.openingHours}</p>
          </Block>
          <Block icon={CalendarDays} title={t("atTheShop")}>
            <p className="text-sm text-muted-foreground">{t("atTheShopBody")}</p>
            <div className="flex flex-wrap gap-2">
              <Link href="/evenementen" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
                <CalendarDays className="size-4" /> {t("toEvents")}
              </Link>
              <Link href="/league" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted">
                {t("leagueTitle")}
              </Link>
              <Link href="/bestellen?modus=bar" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted">
                <UtensilsCrossed className="size-4" /> {t("orderFood")}
              </Link>
            </div>
          </Block>
          <section className="rounded-2xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
            <h2 className="font-semibold text-foreground">{t("cancellationPolicy")}</h2>
            <p className="mt-2 whitespace-pre-line">{s.cancellationPolicy}</p>
          </section>
        </aside>
      </div>
    </PageContainer>
  );
}
