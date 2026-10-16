import { getTranslations } from "next-intl/server";
import { PLATFORM, formatPlatformAddress, hasKvk, hasVat } from "@/lib/platform-config";
import type { FeatureSnapshot } from "@/lib/feature-flags";
import { FooterView, type FooterColumn } from "@/components/ploy/footer-view";
import { LanguageSwitcher } from "./language-switcher";

/**
 * Site-brede footer (design-pass 2026-10, Ploy-stijl): donker paneel met het
 * grote logo, slagzin, contact, vier linkkolommen en de wettelijk verplichte
 * bedrijfsregel. Handelslinks verschijnen alleen zolang hun flag aan staat.
 * Het root-element is <footer>: /bestellen, /keuken, /berichten en de
 * auth-pagina's verbergen 'm via `footer { display: none }`.
 */
export async function SiteFooter({ loggedIn, features }: { loggedIn: boolean; features: FeatureSnapshot }) {
  const [t, tc] = await Promise.all([getTranslations("footer"), getTranslations("common")]);
  const year = new Date().getFullYear();
  const address = formatPlatformAddress();

  const columns: FooterColumn[] = [
    {
      title: t("colShop"),
      links: [
        { label: tc("events"), href: "/evenementen" },
        { label: t("order"), href: "/bestellen?modus=bar" },
        { label: t("sellToUs"), href: "/verkopen" },
        { label: t("infoRules"), href: "/info" },
        ...(features.FEATURE_AUCTIONS ? [{ label: tc("auctions"), href: "/veilingen" }] : []),
        ...(features.FEATURE_CLAIMSALES ? [{ label: tc("claimsales"), href: "/claimsales" }] : []),
        ...(features.FEATURE_MARKETPLACE ? [{ label: tc("marketplace"), href: "/marktplaats" }] : []),
      ],
    },
    {
      title: t("colCommunity"),
      links: [
        { label: tc("league"), href: "/league" },
        { label: tc("news"), href: "/nieuws" },
        { label: t("cardsDb"), href: "/kaarten" },
      ],
    },
    {
      title: t("colAccount"),
      links: loggedIn
        ? [
            { label: tc("dashboard"), href: "/dashboard" },
            { label: t("tickets"), href: "/dashboard/tickets" },
            { label: t("myLeague"), href: "/dashboard/league" },
            { label: tc("messages"), href: "/berichten" },
          ]
        : [
            { label: tc("login"), href: "/login" },
            { label: t("createAccount"), href: "/register" },
          ],
    },
    {
      title: t("colAbout"),
      links: [
        { label: t("contact"), href: "/support" },
        { label: t("privacyPolicy"), href: "/privacy" },
        { label: t("terms"), href: "/voorwaarden" },
      ],
    },
  ];

  return (
    <FooterView
      tagline={t("tagline", { address })}
      contactLabel={PLATFORM.supportEmail}
      contactHref={`mailto:${PLATFORM.supportEmail}`}
      columns={columns}
      legal={[
        { label: t("privacyPolicy"), href: "/privacy" },
        { label: t("terms"), href: "/voorwaarden" },
      ]}
      copyright={t("copyright", { year })}
      legalLine={
        <address className="not-italic">
          <span className="font-medium text-white/85">{PLATFORM.legalName}</span>
          {" · "}
          {address}
          {hasKvk() && <>{" · "}{t("kvk")}: {PLATFORM.kvkNumber}</>}
          {hasVat() && <>{" · "}{t("vat")}: {PLATFORM.vatId}</>}
        </address>
      }
      aside={<LanguageSwitcher tone="dark" />}
    />
  );
}
