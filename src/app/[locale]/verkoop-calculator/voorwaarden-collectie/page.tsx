import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

export const metadata: Metadata = {
  title: "Verkoopvoorwaarden Collectie — Cards Center",
  description:
    "Voorwaarden waaronder Cards Center losse Pokémon-kaarten via de Collectie Calculator inkoopt: prijscorrectie, verzending, calculatie en betaling.",
};

// Legal text — kept inline in Dutch (no i18n) so the wording is locked
// without translation drift; revisit per legal review when expanding to EN.

export default function VoorwaardenCollectiePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: "Verkoop calculator", href: "/verkoop-calculator" },
          { label: "Voorwaarden Collectie" },
        ]}
      />

      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Verkoopovereenkomst Collectie Pokémon-kaarten
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Deze overeenkomst is van toepassing op iedere collectieverkoop (losse kaarten) aan Cards Center via de
          Collectie Calculator. Door het indienen van het verkoopformulier en het verzenden van de kaarten ga je
          akkoord met deze voorwaarden.
        </p>
      </header>

      <div className="space-y-8 text-sm leading-relaxed text-foreground">
        <section>
          <h2 className="mb-2 text-base font-bold">Partijen</h2>
          <p className="text-muted-foreground">
            <strong>Verkoper</strong> — de aanvrager van het verkoopformulier voor collectieverkoop.
            <br />
            <strong>Cards Center</strong> — de koper.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">Artikel 1 — Aanbieding en formulier</h2>
          <p className="mb-2">
            <strong>1.1.</strong> Het door de Verkoper online ingevulde verkoopformulier is een vrijblijvende aanbieding
            tot verkoop. De daarin geselecteerde kaarten en bijbehorende Marktprijs-schattingen zijn een voorlopige
            calculatiebasis.
          </p>
          <p>
            <strong>1.2.</strong> Het daadwerkelijke aanbod tot verkoop wordt gedaan door het fysiek verzenden van het
            pakket met de geselecteerde kaarten naar Cards Center, overeenkomstig de instructies van Cards Center.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">Artikel 2 — Calculatie en prijscorrecties</h2>
          <p className="mb-2">
            <strong>2.1. Prijzen zijn indicatief.</strong> De getoonde inkoopprijs (85% van de Marktprijs) is een
            schatting op basis van actuele marktdata. Prijsfouten kunnen voorkomen. Cards Center controleert elke kaart
            bij ontvangst.
          </p>
          <p className="mb-2">
            <strong>2.2. Prijscorrectie-flow.</strong> Indien Cards Center bij inspectie constateert dat de getoonde
            Marktprijs van een specifieke kaart afweek van de werkelijke marktwaarde, wordt een gecorrigeerde inkoopprijs
            voorgesteld met opgave van reden. De Verkoper accepteert óf weigert deze correctie via het dashboard. De
            inspectie wordt pas afgerond als alle voorgestelde correcties zijn beoordeeld.
          </p>
          <p className="mb-2">
            <strong>2.3. Afgewezen correcties.</strong> Indien de Verkoper een prijscorrectie afwijst, wordt de
            betreffende kaart niet ingekocht en geretourneerd onder de voorwaarden van artikel 4.3.
          </p>
          <p>
            <strong>2.4. Bindende calculatie na ontvangst.</strong> Na verzending zijn de feitelijk ontvangen kaarten
            leidend. De Verkoper kan de definitieve calculatie alleen betwisten op grond van een vermeende reken- of
            telfout (zie artikel 6.3); afwijking van marktprijs is geen grond voor ontbinding zolang de in 2.2 omschreven
            correctie-procedure is gevolgd.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">Artikel 3 — Voorwaarden met betrekking tot de kaarten</h2>
          <p className="mb-2">
            <strong>3.1. Staat (Near Mint).</strong> Alle kaarten dienen in nieuwstaat (Near Mint) te verkeren — vrij van
            krassen, vouwen, deuken, vlekken, off-center prints, edge-wear of andere beschadigingen. Cards Center
            beoordeelt dit volgens branche-gebruikelijke normen. Kaarten die niet aan deze eis voldoen worden afgekeurd
            of teruggestuurd onder artikel 4.3.
          </p>
          <p className="mb-2">
            <strong>3.2. Bescherming.</strong> Iedere ingestuurde kaart dient individueel beschermd te zijn (sleeve in
            combinatie met top-loader of equivalent). Schade ontstaan tijdens transport door onvoldoende verpakking is
            voor risico van de Verkoper.
          </p>
          <p className="mb-2">
            <strong>3.3. Authenticiteit.</strong> Alleen originele, ongegradeerde Pokémon-kaarten worden ingekocht.
            Vervalsingen, proxies, gesneden kaarten of kaarten waaraan is geknutseld worden afgekeurd zonder vergoeding
            en niet geretourneerd.
          </p>
          <p className="mb-2">
            <strong>3.4. Taal.</strong> Uitsluitend Engelstalige kaarten worden geaccepteerd. Niet-Engelstalige kaarten
            worden uit de zending verwijderd, maken geen deel uit van de calculatie, en worden niet aan de Verkoper
            geretourneerd.
          </p>
          <p>
            <strong>3.5. Identificatie.</strong> Voeg een briefje met je naam (zoals opgegeven bij de calculator) en
            e-mailadres toe aan het pakket, en vermeld een afzendadres op de doos. Zonder identificatie kan Cards Center
            de zending niet aan een aanvraag koppelen en kan geen uitbetaling plaatsvinden.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">Artikel 4 — Verzending, risico en kosten</h2>
          <p className="mb-2">
            <strong>4.1. Verplichte verzendwijze.</strong> Gezien de waarde van losse kaarten verzendt de Verkoper het
            pakket aangetekend en verzekerd voor de volledige verwachte verkoopprijs. Bewijs van verzending en
            verzekering dient bewaard te worden.
          </p>
          <p className="mb-2">
            <strong>4.2. Eigen verantwoordelijkheid en risico.</strong> De Verkoper is volledig verantwoordelijk voor
            correcte verzending en aankomst bij Cards Center. Cards Center aanvaardt geen aansprakelijkheid voor tijdens
            transport verloren gegane of beschadigde pakketten, ongeacht de oorzaak.
          </p>
          <p className="mb-2">
            <strong>4.3. Retourkosten.</strong> Bij weigering van een of meer kaarten op grond van artikel 3 of bij
            afgewezen prijscorrecties (artikel 2.3) bedragen de retourkosten € 10,95 per retourpakket. Dit bedrag wordt
            afgetrokken van de koopprijs of in rekening gebracht.
          </p>
          <p>
            <strong>4.4. Verzendtermijn.</strong> Verzending dient binnen 5 dagen na het indienen van de aanvraag plaats
            te vinden. De Track &amp; Trace-code dient via het dashboard ingevoerd te worden zodat Cards Center de
            zending kan volgen.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">Artikel 5 — Betaling en kosten</h2>
          <p className="mb-2">
            <strong>5.1.</strong> Betaling vindt plaats op basis van de definitieve calculatie na ontvangst, inspectie en
            eventuele afronding van de prijscorrectie-flow.
          </p>
          <p className="mb-2">
            <strong>5.2.</strong> Bij uitbetaling via tegoed (saldo) ontvangt de Verkoper 5% extra waarde bovenop de
            definitieve uitbetaling. Bij uitbetaling per bank vindt overschrijving plaats binnen de door Cards Center
            gecommuniceerde termijn.
          </p>
          <p>
            <strong>5.3.</strong> Bij gedeeltelijke of volledige afkeuring op grond van artikel 3, mag Cards Center €20
            aan administratie- en verwerkingskosten in rekening brengen. Dit wordt verrekend met de koopprijs of via
            factuur verhaald.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">Artikel 6 — Slotbepalingen</h2>
          <p className="mb-2">
            <strong>6.1.</strong> Door het verzenden van het pakket verklaart de Verkoper deze overeenkomst gelezen,
            begrepen en onherroepelijk aanvaard te hebben.
          </p>
          <p className="mb-2">
            <strong>6.2.</strong> Het recht op ontbinding door de Verkoper na verzending is uitgesloten, behoudens
            wederrechtelijk handelen door Cards Center.
          </p>
          <p className="mb-2">
            <strong>6.3.</strong> De door Cards Center vastgestelde definitieve calculatie is bindend. Betwisting is
            alleen mogelijk op grond van een vermeende reken- of telfout, schriftelijk en gedetailleerd onderbouwd binnen
            14 kalenderdagen na de calculatiemededeling. Niet of onvoldoende gemotiveerd bezwaar wordt niet in
            behandeling genomen. Na 14 dagen wordt de calculatie geacht definitief en onherroepelijk aanvaard te zijn.
          </p>
          <p>
            <strong>6.4.</strong> Op deze overeenkomst is Nederlands recht van toepassing.
          </p>
        </section>
      </div>
    </div>
  );
}
