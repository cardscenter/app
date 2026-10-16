import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasFeature } from "@/lib/subscription-tiers";
import { PLATFORM } from "@/lib/platform-config";
import { getFeatureSnapshot } from "@/lib/feature-flags";
import { Link } from "@/i18n/navigation";
import { CenteredHero } from "@/components/ploy/centered-hero";
import { TileQuad, type TileItem } from "@/components/ploy/tile-quad";
import { BannerPromo } from "@/components/ploy/banner-promo";
import { CompanyIdentity } from "@/components/legal/company-identity";

export const metadata: Metadata = {
  title: "Support — Cards Center",
};

const PILL = "cc-pill inline-flex items-center gap-1.5 bg-[var(--foreground)] px-5 py-3 text-sm font-semibold leading-none text-white no-underline transition-colors hover:bg-[var(--foreground)]/85";
const PILL_ON_INK = "cc-pill inline-flex items-center gap-1.5 bg-[var(--pastel-yellow)] px-5 py-3 text-sm font-semibold leading-none text-[var(--foreground)] no-underline transition-colors hover:opacity-90";

/**
 * Support-/contactpagina (design-pass Fase D). De "Neem contact op"-links in
 * e-mail-footers wijzen hierheen. Contact loopt via e-mail (noreply-model: de
 * afzender van notificatie-mails wordt niet gelezen). Komt er later een
 * ticketsysteem, dan vervangt dat deze pagina op dezelfde URL zodat oude
 * mails blijven kloppen. Hardcoded NL zoals de juridische pagina's.
 */
export default async function SupportPage() {
  // Voorrang bij support (tier-feature prioritySupport, Fase 45): Unlimited+/
  // Enterprise/Admin krijgen een prioriteitsstrook met een herkenbaar
  // onderwerp-voorvoegsel zodat de mail in de inbox vooraan gesorteerd kan
  // worden. Voor anderen verandert er niets.
  const session = await auth();
  const me = session?.user?.id ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { accountType: true, displayName: true } }) : null;
  const features = getFeatureSnapshot(session?.user?.accountType);
  const priority = me ? hasFeature(me.accountType, "prioritySupport") : false;
  const priorityMailto = me ? `mailto:${PLATFORM.supportEmail}?subject=${encodeURIComponent(`[Voorrang] Vraag van ${me.displayName}`)}` : null;

  const tiles: TileItem[] = [
    {
      title: "Mail ons",
      color: "blue",
      animation: "waves",
      text: "Vermeld je gebruikersnaam en, bij een vraag over een ticket of bestelling, het nummer. We reageren doorgaans binnen twee werkdagen.",
      action: (
        <a href={`mailto:${PLATFORM.supportEmail}`} className={PILL}>
          {PLATFORM.supportEmail}
        </a>
      ),
    },
    {
      title: "In de winkel",
      color: "yellow",
      animation: "scan",
      text: "Het snelst: vraag het aan de bar. Openingstijden, adres en bereikbaarheid staan op de infopagina.",
      action: (
        <Link href="/info" className={PILL}>
          Info en huisregels
        </Link>
      ),
    },
    features.FEATURE_WALLET
      ? {
          title: "Vraag over een bestelling?",
          color: "pink",
          animation: "helix",
          text: "Neem eerst contact op met de verkoper via de chat. Kom je er samen niet uit, dan kun je bij een betaalde bestelling een geschil openen en bemiddelen wij.",
          action: (
            <Link href="/dashboard/geschillen" className={PILL}>
              Geschil openen
            </Link>
          ),
        }
      : {
          title: "Tickets en inschrijvingen",
          color: "pink",
          animation: "helix",
          text: "Je tickets, wachtlijstplekken en annuleringen regel je zelf in je account. Lukt iets niet, mail ons dan met je ticketcode.",
          action: (
            <Link href="/dashboard/tickets" className={PILL}>
              Mijn tickets
            </Link>
          ),
        },
    {
      title: "Veelgestelde vragen",
      color: "ink",
      animation: "pulse",
      text: "Antwoorden over inschrijven, betalen, de league en verkopen aan ons staan bij de onderwerpen zelf.",
      action: (
        <div className="flex flex-wrap gap-2">
          <Link href="/evenementen#faq" className={PILL_ON_INK}>
            Events
          </Link>
          <Link href="/verkopen" className={PILL_ON_INK}>
            Verkopen
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="cc-landing overflow-clip">
      <CenteredHero eyebrow="Support" eyebrowColor="blue" title="Hulp nodig? We helpen je graag" highlightWord="graag" highlightColor="blue" description="Een vraag over een ticket, een inkoop of je account? Kies hieronder de snelste weg." />
      <TileQuad items={tiles} />
      {priority && priorityMailto && (
        <BannerPromo
          eyebrow="Voorrang-support"
          title="Je vraag wordt met voorrang behandeld"
          text="Als Unlimited- of Enterprise-verkoper staat je mail vooraan, ook bij geschillen. De knop vult het onderwerp met [Voorrang] voor je in."
          note={PLATFORM.supportEmail}
          action={
            <a href={priorityMailto} className="cc-pill inline-flex items-center justify-center bg-white px-6 py-4 text-sm font-semibold leading-none text-[var(--foreground)] no-underline transition-colors hover:bg-[var(--background)]">
              Mail met voorrang
            </a>
          }
        />
      )}
      <section className="flex justify-center px-4 pb-16 sm:px-5 lg:px-6 lg:pb-24">
        <div className="w-full max-w-6xl">
          <div className="mx-auto max-w-[42rem]">
            <CompanyIdentity heading="Bedrijfsgegevens" />
          </div>
        </div>
      </section>
    </div>
  );
}
