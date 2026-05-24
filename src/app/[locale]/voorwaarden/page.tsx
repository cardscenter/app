import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";

export const metadata: Metadata = {
  title: "Algemene voorwaarden — Cards Center",
};

/**
 * Algemene voorwaarden (Fase 42). Starter-tekst — vóór publieke launch
 * juridisch laten nakijken.
 */
export default function VoorwaardenPage() {
  return (
    <PageContainer width="narrow" className="py-12">
      <article className="prose prose-slate max-w-none dark:prose-invert">
        <h1 className="text-3xl font-bold text-foreground">
          Algemene voorwaarden
        </h1>
        <p className="text-sm text-muted-foreground">
          Laatst bijgewerkt: 24 mei 2026
        </p>

        <p className="mt-6 text-muted-foreground">
          Welkom bij Cards Center, een online marktplaats voor Pokémon-kaarten
          met veilingen, claimsales en directe verkoop. Door een account aan te
          maken of het platform te gebruiken, ga je akkoord met deze voorwaarden.
        </p>

        <Section title="1. Het platform">
          <p className="text-muted-foreground">
            Cards Center faciliteert de handel tussen kopers en verkopers. We
            zijn zelf geen partij bij de koopovereenkomst, maar bieden de
            infrastructuur (waaronder een wallet en escrow) om transacties veilig
            af te handelen.
          </p>
        </Section>

        <Section title="2. Account">
          <p className="text-muted-foreground">
            Je bent verantwoordelijk voor de juistheid van je gegevens en voor
            het geheimhouden van je inloggegevens. Eén persoon of bedrijf mag in
            principe één account aanhouden. Misbruik kan leiden tot schorsing.
          </p>
        </Section>

        <Section title="3. Kopen, bieden en claimen">
          <p className="text-muted-foreground">
            Een bod of claim is bindend. Betaling verloopt via je wallet; het
            bedrag wordt in escrow gehouden tot de levering is bevestigd. Voor
            veilingen geldt een opgeld (buyer&apos;s premium) bovenop het
            winnende bod; dit wordt vóór het bieden duidelijk getoond.
          </p>
        </Section>

        <Section title="4. Verkopen">
          <p className="text-muted-foreground">
            Als verkoper sta je in voor een juiste omschrijving en tijdige
            verzending. Over de verkoopprijs van items wordt een commissie
            geheven, afhankelijk van je abonnement. Verzendkosten vallen buiten
            de commissie.
          </p>
        </Section>

        <Section title="5. Verzending en levering">
          <p className="text-muted-foreground">
            Verkopers verzenden binnen de afgesproken termijn met een traceerbare
            methode. Bij uitblijvende verzending kan een bestelling automatisch
            worden geannuleerd en terugbetaald.
          </p>
        </Section>

        <Section title="6. Geschillen">
          <p className="text-muted-foreground">
            Komen koper en verkoper er onderling niet uit, dan kan een geschil
            worden geopend. Cards Center kan dan bemiddelen en, indien nodig, een
            bindende beslissing nemen over de escrow.
          </p>
        </Section>

        <Section title="7. Verboden gebruik">
          <p className="text-muted-foreground">
            Niet toegestaan zijn onder meer: nep-biedingen op eigen veilingen
            (shill bidding), namaak of illegale items, en het omzeilen van het
            platform om commissie te ontwijken.
          </p>
        </Section>

        <Section title="8. Aansprakelijkheid">
          <p className="text-muted-foreground">
            Cards Center spant zich in voor een betrouwbaar platform, maar is
            niet aansprakelijk voor schade die voortvloeit uit het handelen van
            gebruikers onderling, behoudens wettelijke uitzonderingen.
          </p>
        </Section>

        <Section title="9. Wijzigingen">
          <p className="text-muted-foreground">
            We kunnen deze voorwaarden aanpassen. Bij belangrijke wijzigingen
            informeren we je tijdig. Vragen? Mail{" "}
            <a
              href="mailto:info@poke-center.nl"
              className="font-medium text-primary hover:underline"
            >
              info@poke-center.nl
            </a>
            .
          </p>
        </Section>
      </article>
    </PageContainer>
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
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
