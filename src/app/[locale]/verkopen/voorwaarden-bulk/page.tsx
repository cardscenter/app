import type { Metadata } from "next";
import { ArticleLayout } from "@/components/ploy/article-layout";
import { Pill } from "@/components/ploy/pill";

export const metadata: Metadata = {
  title: "Verkoopvoorwaarden Bulk — Cards Center",
  description:
    "Voorwaarden waaronder Cards Center bulk Pokémon-kaarten inkoopt: verzending, calculatie, betaling en retourregeling.",
};

// The contract text below is a legal document — keep inline as Dutch-only
// source of truth. Translating legal prose needs legal review; we'll surface
// EN later via a separate reviewed copy if needed.

export default function VoorwaardenPage() {
  return (
    <div className="cc-landing overflow-clip">
      <ArticleLayout back={{ href: "/verkopen", label: "Verkopen" }} meta={<Pill tone="white">Verkoopovereenkomst bulk</Pill>} title="Verkoopovereenkomst Bulk Pokémon-kaarten" lead={<>Deze overeenkomst is van toepassing op iedere bulkverkoop aan Cards Center. Door het indienen van het verkoopformulier en het verzenden van de kaarten ga je akkoord met deze voorwaarden.</>}>
      <div className="space-y-10 text-[17px] leading-[1.65] text-[var(--foreground)]/85">
        <section>
          <h2 className="mb-3 text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">Partijen</h2>
          <p className="text-[var(--foreground)]/70">
            <strong className="font-semibold text-[var(--foreground)]">Verkoper</strong> — de aanvrager van het verkoopformulier voor bulkverkoop.
            <br />
            <strong className="font-semibold text-[var(--foreground)]">Cards Center</strong> — de koper.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">Artikel 1 — Aanbieding en formulier</h2>
          <p className="mb-2">
            <strong className="font-semibold text-[var(--foreground)]">1.1.</strong> Het door de Verkoper online ingevulde verkoopformulier is een vrijblijvende aanbieding
            tot verkoop. De daarin opgegeven aantallen en categorieën zijn een voorlopige calculatiebasis.
          </p>
          <p>
            <strong className="font-semibold text-[var(--foreground)]">1.2.</strong> Het daadwerkelijke aanbod tot verkoop wordt gedaan door het fysiek verzenden van het
            pakket met kaarten naar Cards Center, overeenkomstig de instructies van Cards Center.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">Artikel 2 — Bindende en definitieve calculatie</h2>
          <p className="mb-2">
            <strong className="font-semibold text-[var(--foreground)]">2.1.</strong> De Verkoper verklaart uitdrukkelijk te begrijpen dat na verzending de verkoop bindend
            is. De feitelijke aantallen die in de ontvangen pakketten aanwezig zijn, zijn leidend voor de definitieve
            calculatie en betaling.
          </p>
          <p className="mb-2">
            <strong className="font-semibold text-[var(--foreground)]">2.2.</strong> Indien de door de Verkoper in het formulier opgegeven informatie onjuist of onvolledig
            blijkt, heeft Cards Center het recht een nieuwe, definitieve calculatie te maken op basis van de werkelijk
            ontvangen kaarten. De Verkoper is verplicht deze herziene calculatie te accepteren. Er is geen recht op
            ontbinding van de overeenkomst op basis van een lagere uitkomst.
          </p>
          <p>
            <strong className="font-semibold text-[var(--foreground)]">2.3.</strong> Cards Center behoudt zich het recht voor de overeenkomst geheel te weigeren en het
            pakket op kosten van de Verkoper retour te zenden, indien de discrepantie tussen het formulier en de
            werkelijk ontvangen aantallen naar oordeel van Cards Center dusdanig groot is dat dit niet meer als een
            onschuldige fout kan worden aangemerkt. In dat geval zijn de retourkosten uit artikel 4.3 verschuldigd.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">Artikel 3 — Voorwaarden met betrekking tot de kaarten</h2>
          <p className="mb-2">
            <strong className="font-semibold text-[var(--foreground)]">3.1. Staat.</strong> Alle kaarten dienen in nieuwstaat (Near Mint) te verkeren — vrij van krassen,
            vouwen, deuken, vlekken of andere beschadigingen, zoals beoordeeld door Cards Center volgens
            branche-gebruikelijke normen. Cards Center behoudt zich het recht voor om (een deel van) de bulk te weigeren
            en op kosten van de Verkoper (€10,95 per pakket) retour te sturen.
          </p>
          <p className="mb-2">
            <strong className="font-semibold text-[var(--foreground)]">3.2. Basic Energy kaarten.</strong> De Verkoper verklaart dat er geen Basic Energy kaarten meer in
            de bulk aanwezig zijn, met uitzondering van een enkel exemplaar.
          </p>
          <p className="mb-2">
            <strong className="font-semibold text-[var(--foreground)]">3.3. TCG Live Codes.</strong> Indien van toepassing verklaart de Verkoper dat alle TCG Live
            Codekaarten ongebruikt zijn.
          </p>
          <p className="mb-2">
            <strong className="font-semibold text-[var(--foreground)]">3.4. Taal.</strong> Uitsluitend Engelstalige kaarten worden gekocht en geaccepteerd. Niet-Engelstalige
            kaarten worden uit de zending verwijderd, maken geen deel uit van de calculatie, en worden niet aan de
            Verkoper geretourneerd.
          </p>
          <p>
            <strong className="font-semibold text-[var(--foreground)]">3.5. Sortering.</strong> De kaarten dienen bij verzending onderverdeeld te zijn in de door Cards
            Center aangegeven categorieën. Indien niet correct gesorteerd, behoudt Cards Center zich het recht voor alle
            kaarten tegen het tarief voor de laagste categorie (Common/Uncommon) te berekenen.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">Artikel 4 — Verzending, risico en kosten</h2>
          <p className="mb-2">
            <strong className="font-semibold text-[var(--foreground)]">4.1. Verplichte verzendwijze.</strong> De Verkoper verzendt het pakket aangetekend en verzekerd voor
            de volledige verwachte verkoopprijs. Bewijs van verzending en verzekering dient bewaard te worden.
          </p>
          <p className="mb-2">
            <strong className="font-semibold text-[var(--foreground)]">4.2. Eigen verantwoordelijkheid en risico.</strong> De Verkoper is volledig verantwoordelijk voor
            correcte verzending en aankomst bij Cards Center. Cards Center aanvaardt geen aansprakelijkheid voor tijdens
            transport verloren gegane of beschadigde pakketten, ongeacht de oorzaak.
          </p>
          <p>
            <strong className="font-semibold text-[var(--foreground)]">4.3. Retourkosten.</strong> Bij weigering op grond van artikel 3.1 of artikel 2.3 bedragen de
            retourkosten €10,95 per retourpakket. Dit bedrag wordt afgetrokken van de koopprijs of in rekening gebracht.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">Artikel 5 — Betaling en kosten</h2>
          <p className="mb-2">
            <strong className="font-semibold text-[var(--foreground)]">5.1.</strong> Betaling vindt plaats op basis van de definitieve calculatie (artikel 2) na ontvangst
            en inspectie.
          </p>
          <p className="mb-2">
            <strong className="font-semibold text-[var(--foreground)]">5.2.</strong> Betalingswijze en termijn worden door Cards Center gecommuniceerd na de definitieve
            calculatie.
          </p>
          <p>
            <strong className="font-semibold text-[var(--foreground)]">5.3.</strong> Bij gedeeltelijke of volledige afkeuring op grond van artikel 3, mag Cards Center €20
            aan administratie- en verwerkingskosten in rekening brengen. Dit wordt verrekend met de koopprijs of via
            factuur verhaald.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">Artikel 6 — Slotbepalingen</h2>
          <p className="mb-2">
            <strong className="font-semibold text-[var(--foreground)]">6.1.</strong> Door het verzenden van het pakket verklaart de Verkoper deze overeenkomst gelezen,
            begrepen en onherroepelijk aanvaard te hebben.
          </p>
          <p className="mb-2">
            <strong className="font-semibold text-[var(--foreground)]">6.2.</strong> Het recht op ontbinding door de Verkoper na verzending is uitgesloten, behoudens
            wederrechtelijk handelen door Cards Center.
          </p>
          <p className="mb-2">
            <strong className="font-semibold text-[var(--foreground)]">6.3.</strong> De door Cards Center vastgestelde definitieve calculatie is bindend. Betwisting is
            alleen mogelijk op grond van een vermeende reken- of telfout, schriftelijk en gedetailleerd onderbouwd
            binnen 14 kalenderdagen na de calculatiemededeling. Niet of onvoldoende gemotiveerd bezwaar wordt niet in
            behandeling genomen. Na 14 dagen wordt de calculatie geacht definitief en onherroepelijk aanvaard te zijn.
          </p>
          <p>
            <strong className="font-semibold text-[var(--foreground)]">6.4.</strong> Op deze overeenkomst is Nederlands recht van toepassing.
          </p>
        </section>
      </div>
      </ArticleLayout>
    </div>
  );
}
