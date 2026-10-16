import type { Metadata } from "next";
import { ArticleLayout } from "@/components/ploy/article-layout";
import { Pill } from "@/components/ploy/pill";
import { PLATFORM } from "@/lib/platform-config";
import { CompanyIdentity } from "@/components/legal/company-identity";

export const metadata: Metadata = {
  title: "Privacybeleid — Cards Center",
};

/**
 * Privacybeleid (Fase 42). Starter-tekst met de wettelijk vereiste passages
 * (o.a. IP-tracking voor anti-shill-bidding, Fase 29). Vóór publieke launch
 * juridisch laten nakijken.
 */
export default function PrivacyPage() {
  return (
    <div className="cc-landing overflow-clip">
      <ArticleLayout meta={<><Pill tone="white">Privacy</Pill><Pill tone="pastel" color="blue">Laatst bijgewerkt: 6 september 2026</Pill></>} title="Privacybeleid" lead={<>Cards Center respecteert je privacy. In dit beleid leggen we uit welke persoonsgegevens we verwerken, waarom, en welke rechten je hebt. We verwerken gegevens conform de Algemene Verordening Gegevensbescherming (AVG/GDPR).</>}>

        <CompanyIdentity heading="Verwerkingsverantwoordelijke" />

        <Section title="1. Welke gegevens we verzamelen">
          <ul className="list-disc space-y-1.5 pl-5 text-[var(--foreground)]/75">
            <li>
              <strong>Accountgegevens:</strong> e-mailadres, gebruikersnaam,
              voor- en achternaam, en (bij zakelijke accounts) bedrijfsnaam,
              KvK- en btw-nummer.
            </li>
            <li>
              <strong>Adres- en contactgegevens:</strong> straat, huisnummer,
              postcode, plaats en land — nodig voor verzending en facturatie.
            </li>
            <li>
              <strong>Financiële gegevens:</strong> IBAN en tenaamstelling voor
              uitbetalingen, en transactiegeschiedenis binnen je wallet.
            </li>
            <li>
              <strong>Technische gegevens:</strong> IP-adres, inloggegevens en
              apparaatinformatie.
            </li>
          </ul>
        </Section>

        <Section title="2. Waarom we deze gegevens verwerken">
          <ul className="list-disc space-y-1.5 pl-5 text-[var(--foreground)]/75">
            <li>Het aanmaken en beheren van je account.</li>
            <li>
              Het uitvoeren van koop-, verkoop- en veilingtransacties, inclusief
              escrow-afhandeling.
            </li>
            <li>Het verzenden van bestellingen en het afhandelen van geschillen.</li>
            <li>
              Fraudepreventie en de beveiliging van het platform (zie sectie 4).
            </li>
            <li>Wettelijke verplichtingen, zoals administratie en belasting.</li>
          </ul>
        </Section>

        <Section title="3. IP-adressen en fraudepreventie">
          <p className="text-[var(--foreground)]/75">
            We verwerken IP-adressen voor anti-shill-bidding-detectie (het
            tegengaan van nep-biedingen op eigen veilingen) en bredere
            fraudepreventie. IP-adressen die aan biedingen gekoppeld zijn,
            bewaren we maximaal 90 dagen, daarna worden ze geanonimiseerd.
          </p>
        </Section>

        <Section title="4. Hoe lang we gegevens bewaren">
          <p className="text-[var(--foreground)]/75">
            We bewaren je gegevens niet langer dan nodig voor de doeleinden
            hierboven of dan wettelijk vereist (zoals de fiscale
            bewaarplicht). Geüploade foto&apos;s van afgeronde verkopen worden
            30 dagen na voltooiing automatisch opgeruimd.
          </p>
        </Section>

        <Section title="5. Met wie we gegevens delen">
          <p className="text-[var(--foreground)]/75">
            We verkopen je gegevens nooit. We delen alleen wat nodig is met
            verwerkers die ons platform draaiende houden (hosting, opslag,
            e-mailverzending) en met de tegenpartij van een transactie voor
            zover nodig om te leveren (bijvoorbeeld een verzendadres).
          </p>
        </Section>

        <Section title="6. Je rechten">
          <p className="text-[var(--foreground)]/75">
            Je hebt het recht op inzage, correctie, verwijdering en overdracht
            van je gegevens, en je kunt bezwaar maken tegen verwerking. Neem
            hiervoor contact op via{" "}
            <a
              href={`mailto:${PLATFORM.supportEmail}`}
              className="font-semibold text-[var(--primary)] hover:underline"
            >
              {PLATFORM.supportEmail}
            </a>
            .
          </p>
        </Section>

        <Section title="7. Contact">
          <p className="text-[var(--foreground)]/75">
            Vragen over dit privacybeleid? Mail{" "}
            <a
              href={`mailto:${PLATFORM.supportEmail}`}
              className="font-semibold text-[var(--primary)] hover:underline"
            >
              {PLATFORM.supportEmail}
            </a>
            .
          </p>
        </Section>
      </ArticleLayout>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">{title}</h2>
      <div className="mt-3 space-y-3 text-[17px] leading-[1.65]">{children}</div>
    </section>
  );
}
