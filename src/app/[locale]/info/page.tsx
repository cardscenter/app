import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ExternalLink, Mail, MapPin } from "lucide-react";
import { getHubSettings } from "@/lib/app-config";
import { fullCardReward, rewardSentence } from "@/lib/community/config";
import { formatPrice } from "@/lib/shop-events/format";
import { toParagraphs } from "@/lib/community/config";
import { formatShopAddress, PLATFORM } from "@/lib/platform-config";
import { CenteredHero, TileQuad, FeatureRows, FaqSection, BannerPromo, ClosingCta, CtaButton } from "@/components/ploy";
import { Panel } from "@/components/ploy/panel";
import { SectionHead } from "@/components/ploy/section-head";
import { ShopMap, type ShopMapMode } from "@/components/community/shop-map";

export const dynamic = "force-dynamic";

const WEBSITE = "https://cards-center.nl";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "community" });
  return { title: `${t("infoTitle")} | Cards Center`, description: t("infoMeta") };
}

/**
 * Info-pagina (design-pass, Ploy-stijl): hero met veegstreep op "Hulst",
 * vier tegels (adres, openingstijden, bereikbaarheid, contact), huisregels
 * als genummerde rijen, een donkere strook naar events/league/bestellen,
 * vragen en een slotpaneel. Teksten uit de hub-instellingen.
 */
export default async function InfoPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, te, s] = await Promise.all([getTranslations("community"), getTranslations("shopEvents"), getHubSettings()]);
  const address = formatShopAddress();
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${PLATFORM.shop.name}, ${address}`)}`;
  const linkCls = "inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4";
  const rules = toParagraphs(s.houseRules);
  const directions = toParagraphs(s.directions);
  // Plattegrond: routes per vervoerswijze, met een Google Maps-link in dezelfde modus.
  const routeUrl = (travelmode: "driving" | "bicycling" | "transit") => `${mapsUrl}&travelmode=${travelmode}`;
  const mapModes: ShopMapMode[] = [
    { key: "car", title: t("mapCar"), text: t("mapCarText"), fact: t("mapCarFact"), mapsUrl: routeUrl("driving") },
    { key: "bike", title: t("mapBike"), text: t("mapBikeText"), fact: t("mapBikeFact"), mapsUrl: routeUrl("bicycling") },
    { key: "bus", title: t("mapBus"), text: t("mapBusText"), fact: t("mapBusFact"), mapsUrl: routeUrl("transit") },
  ];

  return (
    <div className="cc-landing overflow-clip">
      <CenteredHero title={t("infoHeroTitle")} highlightWord={PLATFORM.shop.city} highlightColor="green" description={t("infoIntro")} />

      <TileQuad
        items={[
          {
            id: "adres",
            title: t("address"),
            color: "pink",
            animation: "pulse",
            text: (
              <>
                <strong className="text-[var(--foreground)]">{PLATFORM.shop.name}</strong>
                <br />
                {address}
              </>
            ),
            action: (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={`${linkCls} text-[var(--foreground)]`}>
                <MapPin className="size-4" /> {t("planRoute")}
              </a>
            ),
          },
          { id: "openingstijden", title: t("openingHours"), color: "yellow", animation: "scan", text: <span className="whitespace-pre-line">{s.openingHours}</span> },
          {
            id: "bereikbaarheid",
            title: t("directions"),
            color: "blue",
            animation: "waves",
            text: directions.map((p, i) => (
              <p key={i} className={i > 0 ? "mt-2" : ""}>
                {p}
              </p>
            )),
            action: (
              <a href="#plattegrond" className={`${linkCls} text-[var(--foreground)]`}>
                <MapPin className="size-4" /> {t("seeMap")}
              </a>
            ),
          },
          {
            id: "contact",
            title: t("infoContact"),
            color: "ink",
            animation: "helix",
            text: t("infoContactText"),
            action: (
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                <a href={`mailto:${PLATFORM.supportEmail}`} className={`${linkCls} text-white`}>
                  <Mail className="size-4" /> {PLATFORM.supportEmail}
                </a>
                <a href={WEBSITE} target="_blank" rel="noopener noreferrer" className={`${linkCls} text-white`}>
                  <ExternalLink className="size-4" /> {t("infoWebsite")}
                </a>
              </div>
            ),
          },
        ]}
      />

      <Panel color="green" id="plattegrond">
        <SectionHead title={t("mapTitle")} />
        <ShopMap
          modes={mapModes}
          images={{
            main: "/images/sections/plattegrond-main.webp",
            car: "/images/sections/plattegrond-car.webp",
            bike: "/images/sections/plattegrond-bike.webp",
            bus: "/images/sections/plattegrond-bus.webp",
          }}
          labels={{
            intro: t("mapIntro", { address: address }),
            hint: t("mapHint"),
            routeLabel: t("mapRouteIn"),
            enlargeLabel: t("mapEnlarge"),
            closeLabel: t("mapClose"),
            alt: t("mapAlt"),
          }}
        />
      </Panel>

      <FeatureRows id="huisregels" title={t("houseRules")} intro={t("infoRulesIntro")} rows={rules.map((p, i) => ({ number: String(i + 1).padStart(2, "0"), text: p }))} />

      <BannerPromo
        eyebrow={t("atTheShop")}
        title={t("atTheShopBody")}
        action={
          <div className="flex flex-wrap gap-2">
            <CtaButton href="/evenementen" variant="light">
              {t("toEvents")}
            </CtaButton>
            <CtaButton href="/league" variant="ghost">
              {t("leagueTitle")}
            </CtaButton>
            <CtaButton href="/bestellen?modus=bar" variant="ghost">
              {t("orderFood")}
            </CtaButton>
          </div>
        }
      />

      <FaqSection
        eyebrow={te("faqEyebrow")}
        title={t("infoFaqTitle")}
        items={[
          { q: t("infoFaq1Q"), a: s.cancellationPolicy },
          { q: t("infoFaq2Q"), a: `${te("underTwelveLine")} ${te("guardianLine")}` },
          { q: t("infoFaq3Q"), a: t("infoFaq3A") },
          {
            q: t("infoFaq4Q"),
            a: t("infoFaq4A", {
              n: s.stampsPerCard,
              reward: rewardSentence(fullCardReward(s), {
                points: (points, euro) => t("fullCardRewardPoints", { points, euro: formatPrice(euro, locale) }),
                none: t("infoFaq4Fallback"),
              }),
            }),
          },
        ]}
      />

      <ClosingCta color="green" title={t("infoClosingTitle")} text={t("infoClosingText")}>
        <CtaButton href="/evenementen" variant="dark">
          {t("toEvents")}
        </CtaButton>
        <CtaButton href="/register" variant="light">
          {te("bannerCta")}
        </CtaButton>
      </ClosingCta>
    </div>
  );
}
