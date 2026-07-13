import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageContainer } from "@/components/layout/page-container";
import {
  BID_RESERVE_RATE,
  VERIFIED_BID_THRESHOLD,
  PAYMENT_FAILURE_FEE_RATE,
  STRIKE_TEMP_SUSPEND_THRESHOLD,
  STRIKE_TEMP_SUSPEND_DAYS,
  STRIKE_PERMANENT_THRESHOLD,
  STRIKE_DECAY_DAYS,
  IP_OVERLAP_LOOKBACK_DAYS,
  BID_IP_RETENTION_DAYS,
} from "@/lib/auction/bid-tiers";

export const metadata: Metadata = {
  title: "Veilingvoorwaarden — Cards Center",
  description:
    "Voorwaarden voor het bieden op en winnen van veilingen op Cards Center: bindende biedingen, reserves, betaaltermijnen, wanbetaling en strike-systeem.",
};

// Legal-document — NL als source of truth. EN-versie volgt na juridische
// review (zelfde aanpak als /verkoop-calculator/voorwaarden).

const RESERVE_PERCENTAGE_DISPLAY = `${Math.round(BID_RESERVE_RATE * 100)}%`;
const FAILURE_FEE_DISPLAY = `${(PAYMENT_FAILURE_FEE_RATE * 100).toFixed(1).replace(/\.0$/, "").replace(".", ",")}%`;

export default function VeilingenVoorwaardenPage() {
  return (
    <PageContainer width="narrow" className="py-8">
      <Breadcrumbs items={[{ label: "Veilingen", href: "/veilingen" }, { label: "Voorwaarden" }]} />

      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Veilingvoorwaarden</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Deze voorwaarden zijn van toepassing op iedere veiling die via Cards Center wordt aangeboden, geboden en
          afgewikkeld. Door een bod uit te brengen of een Direct Kopen-aankoop te doen ga je akkoord met deze
          voorwaarden. Versie 2026-05-04.
        </p>
      </header>

      <div className="space-y-8 text-sm leading-relaxed text-foreground">
        <section>
          <h2 className="mb-2 text-base font-bold">Partijen</h2>
          <p className="text-muted-foreground">
            <strong>Cards Center</strong> — exploitant van het platform en faciliteerder van de veiling. Cards Center is
            geen partij bij de koopovereenkomst tussen Verkoper en Bieder; we treden op als technische tussenpersoon
            voor escrow, betaalverwerking en geschillenbeslechting.
            <br />
            <strong>Verkoper</strong> — geregistreerd account dat een veiling start.
            <br />
            <strong>Bieder</strong> — geregistreerd account dat een bod uitbrengt of een Direct Kopen-aankoop doet.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">Artikel 1 — Toepasselijkheid</h2>
          <p className="mb-2">
            <strong>1.1.</strong> Deze voorwaarden gelden naast de Algemene Gebruikersvoorwaarden van Cards Center. Bij
            tegenstrijdigheid tussen de Algemene Gebruikersvoorwaarden en deze Veilingvoorwaarden, prevaleren deze
            Veilingvoorwaarden voor zover het de veiling-flow betreft.
          </p>
          <p>
            <strong>1.2.</strong> Cards Center is een Nederlands platform. Op deze voorwaarden is Nederlands recht van
            toepassing. Geschillen worden voorgelegd aan de bevoegde rechter in het arrondissement waar Cards Center
            statutair gevestigd is, tenzij dwingend recht anders bepaalt.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">Artikel 2 — Account en verificatie</h2>
          <p className="mb-2">
            <strong>2.1.</strong> Bieden vereist een geregistreerd account. De Bieder is verplicht juiste, volledige en
            actuele NAW-gegevens op te geven en deze actueel te houden.
          </p>
          <p className="mb-2">
            <strong>2.2.</strong> De Bieder dient minimaal 18 jaar oud te zijn.
          </p>
          <p className="mb-2">
            <strong>2.3.</strong> Voor biedingen of Direct Kopen-aankopen vanaf <strong>€{VERIFIED_BID_THRESHOLD}</strong>{" "}
            is een geverifieerd account verplicht. Verificatie verloopt via upload van een geldig Nederlands
            identiteitsbewijs, paspoort of rijbewijs en wordt door Cards Center handmatig beoordeeld. Pogingen om
            zonder verificatie boven deze drempel te bieden worden door het systeem geweigerd.
          </p>
          <p>
            <strong>2.4.</strong> Cards Center kan op elk moment aanvullende verificatie verlangen (identiteit, adres of
            bankgegevens) als daar redelijke grond toe is. Tot deze aanvullende verificatie kan het account worden
            beperkt voor verdere biedingen.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">
            Artikel 3 — Bieden en {RESERVE_PERCENTAGE_DISPLAY}-reservering
          </h2>
          <p className="mb-2">
            <strong>3.1.</strong> Bij elk bod wordt automatisch <strong>{RESERVE_PERCENTAGE_DISPLAY}</strong> van het
            bedrag op het saldo van de Bieder vastgehouden als zekerheid. Deze reservering blijft staan zolang het bod
            de hoogste is, en valt vrij zodra de Bieder wordt overboden.
          </p>
          <p className="mb-2">
            <strong>3.2.</strong> De Bieder kan alleen bieden tot zover het beschikbare saldo (saldo minus reeds
            vastgehouden reserveringen) de benodigde {RESERVE_PERCENTAGE_DISPLAY}-zekerheid dekt.
          </p>
          <p>
            <strong>3.3.</strong> Een bod kan niet worden ingetrokken. Een bod is een bindende verklaring tot koop voor
            het bedrag, op de voorwaarden van de specifieke veiling. Tikfouten of verkeerde bedragen geven geen recht op
            intrekking.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">Artikel 4 — Auto-bod (proxy bidding)</h2>
          <p className="mb-2">
            <strong>4.1.</strong> De Bieder kan een maximumbedrag instellen waarvoor het systeem automatisch
            tegenbiedingen plaatst. Het systeem biedt steeds het minimum-verhogingsbedrag boven de huidige hoogste
            bieder, tot het opgegeven maximum.
          </p>
          <p>
            <strong>4.2.</strong> Een actief auto-bod telt als bindend bod ter hoogte van de maximum-instelling. De
            {RESERVE_PERCENTAGE_DISPLAY}-zekerheid op het maximum wordt vastgehouden zolang het auto-bod actief is.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">Artikel 5 — Anti-snipe (eindetijd-verlenging)</h2>
          <p>
            <strong>5.1.</strong> Wordt er een geldig bod uitgebracht binnen 2 minuten voor de oorspronkelijke eindtijd,
            dan wordt de eindtijd automatisch met 2 minuten verlengd. Deze verlenging herhaalt zich zo lang er
            biedingen worden uitgebracht binnen het laatste 2-minuten-venster.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">Artikel 6 — Direct Kopen</h2>
          <p className="mb-2">
            <strong>6.1.</strong> Indien de Verkoper een Direct Kopen-prijs heeft vastgesteld, kan de veiling direct
            worden afgerond door betaling van de Direct Kopen-prijs. Dit beëindigt de veiling onmiddellijk.
          </p>
          <p>
            <strong>6.2.</strong> Zodra biedingen 75% van de Direct Kopen-prijs hebben bereikt, vervalt de Direct
            Kopen-optie en gaat de veiling regulier door tot eindtijd.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">Artikel 7 — Reserveprijs</h2>
          <p>
            <strong>7.1.</strong> De Verkoper kan een verborgen reserveprijs instellen. Wordt deze niet gehaald, dan
            wordt de veiling afgerond zonder verkoop en zonder verplichting voor partijen. De Bieder krijgt zijn
            reservering teruggestort.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">Artikel 8 — Bindend winnend bod</h2>
          <p className="mb-2">
            <strong>8.1.</strong> De Bieder met het hoogste geldige bod op het moment van eindtijd is contractueel
            verplicht het kavel af te nemen voor het bedrag van zijn bod, vermeerderd met eventuele verzendkosten en
            commissies zoals zichtbaar tijdens het bieden.
          </p>
          <p>
            <strong>8.2.</strong> Het tot stand komen van de koopovereenkomst geschiedt op het moment dat de eindtijd
            verstrijkt en de Bieder als winnaar wordt aangemerkt. Vanaf dat moment is de overeenkomst bindend voor
            beide partijen.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">Artikel 9 — Betaling na winnen</h2>
          <p className="mb-2">
            <strong>9.1.</strong> Indien de Bieder bij eindtijd voldoende beschikbaar saldo heeft om het volledige
            eindbedrag te dekken, wordt dit bedrag direct van zijn saldo afgeschreven en in escrow geplaatst voor de
            Verkoper.
          </p>
          <p className="mb-2">
            <strong>9.2.</strong> Bij gedeeltelijk saldo (minimaal {RESERVE_PERCENTAGE_DISPLAY} maar minder dan 100%)
            geldt een betaaltermijn van <strong>5 dagen</strong> na eindtijd. De Bieder dient binnen deze termijn zijn
            saldo aan te vullen en de betaling te voltooien via de payment-knop in zijn dashboard. Tijdens deze
            5-dagen-termijn blijven de gereserveerde {RESERVE_PERCENTAGE_DISPLAY} vastgehouden.
          </p>
          <p>
            <strong>9.3.</strong> De Bieder kan tot het verstrijken van de betaaltermijn betalen via een
            bankoverschrijving (bevestigd door admin) of via toekomstig beschikbare directe betaalmethoden.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">Artikel 10 — Wanbetaling en gevolgen</h2>
          <p className="mb-2">
            <strong>10.1.</strong> Wordt het volledige eindbedrag niet binnen de betaaltermijn voldaan, dan is sprake
            van wanbetaling. Cards Center markeert de veiling als <em>PAYMENT_FAILED</em> en zet onderstaande
            maatregelen in werking.
          </p>
          <p className="mb-2">
            <strong>10.2.</strong>{" "}
            <strong>Borg-forfait: de {RESERVE_PERCENTAGE_DISPLAY}-reservering verbeurt</strong> — bij wanbetaling
            verbeurt de volledige {RESERVE_PERCENTAGE_DISPLAY}-reservering ({RESERVE_PERCENTAGE_DISPLAY} van het
            winnende bod plus veilingkosten) die bij het bieden op het saldo werd vastgehouden, aan Cards Center, ter
            vergoeding van administratieve kosten. Dit geldt voor elk eindbedrag. Bij ontoereikend saldo wordt zoveel
            mogelijk afgeschreven met een ondergrens van €0; het restant blijft als openstaande schuld geregistreerd en
            wordt verrekend met de eerstvolgende inkomsten op het account.
          </p>
          <p className="mb-2">
            <strong>10.3.</strong>{" "}
            <strong>Wanbetalingskosten {FAILURE_FEE_DISPLAY}</strong> — daarnaast wordt {FAILURE_FEE_DISPLAY} van het
            winnende bod als kosten in rekening gebracht, eveneens voor elk eindbedrag en met dezelfde
            schuld-verrekening bij ontoereikend saldo.
          </p>
          <p className="mb-2">
            <strong>10.4.</strong>{" "}
            <strong>Strike</strong> — bij elke wanbetaling (ongeacht het bedrag) wordt aan het account één{" "}
            <em>strike</em> toegevoegd. Strikes blijven {STRIKE_DECAY_DAYS} dagen op het account staan; daarna verlaagt
            het systeem automatisch de teller met één per ronde.
          </p>
          <p className="mb-2">
            <strong>10.5.</strong> <strong>Runner-up rotatie</strong> — als de Verkoper deze optie heeft ingeschakeld
            (standaard aan), wordt het kavel automatisch toegewezen aan de eerstvolgende hoogste bieder die nog niet als
            wanbetaler is gemarkeerd. Deze runner-up krijgt een nieuwe 5-dagen-betaaltermijn voor diens oorspronkelijke
            bod-bedrag.
          </p>
          <p>
            <strong>10.6.</strong> De Bieder erkent dat de bovenstaande gevolgen contractueel rechtvaardig en
            proportioneel zijn voor het ondervangen van de schade en operationele last die wanbetaling veroorzaakt.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">Artikel 11 — Schorsing bij herhaalde wanbetaling</h2>
          <p className="mb-2">
            <strong>11.1.</strong> Bij <strong>{STRIKE_TEMP_SUSPEND_THRESHOLD} actieve strikes</strong> wordt het
            account automatisch geschorst voor een periode van <strong>{STRIKE_TEMP_SUSPEND_DAYS} dagen</strong>.
            Tijdens schorsing kan het account niet bieden, niet kopen, niet verkopen en geen berichten versturen.
            Lopende verzendingen en uitbetaling-aanvragen blijven mogelijk.
          </p>
          <p className="mb-2">
            <strong>11.2.</strong> Bij <strong>{STRIKE_PERMANENT_THRESHOLD} actieve strikes</strong> wordt het account
            permanent geschorst. Een permanente schorsing kan alleen door admin-tussenkomst worden opgeheven.
          </p>
          <p>
            <strong>11.3.</strong> Een schorsing wordt niet automatisch opgeheven wanneer de strike-teller weer onder
            de drempel zakt. De Bieder dient contact op te nemen met support.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">Artikel 12 — Vrijstelling voor zakelijke accounts</h2>
          <p className="mb-2">
            <strong>12.1.</strong> Geregistreerde zakelijke accounts (BUSINESS-account met geldig KvK-nummer en
            BTW-nummer) kunnen door Cards Center handmatig worden vrijgesteld van de verificatie-eis bij biedingen
            vanaf €{VERIFIED_BID_THRESHOLD}.
          </p>
          <p>
            <strong>12.2.</strong> Vrijstelling laat het borg-forfait bij wanbetaling onverlet. Vrijstelling kan op elk
            moment door Cards Center worden ingetrokken zonder opgaaf van reden.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">Artikel 13 — Anti-shill bidding</h2>
          <p className="mb-2">
            <strong>13.1.</strong> Het is uitdrukkelijk verboden om biedingen uit te brengen op de eigen veiling of op
            de veiling van een aan jou gelieerde derde, met als doel de prijs op te drijven (<em>shill bidding</em>).
            Overtreding leidt tot directe schorsing en kan civielrechtelijk worden vervolgd.
          </p>
          <p className="mb-2">
            <strong>13.2.</strong> Cards Center monitort biedingen op verdachte patronen, waaronder gedeelde IP-adressen
            tussen Verkoper en Bieder. Indien een Bieder vanaf hetzelfde netwerk biedt als waar de Verkoper recent (
            {IP_OVERLAP_LOOKBACK_DAYS} dagen) heeft ingelogd, wordt het bod geweigerd.
          </p>
          <p>
            <strong>13.3.</strong> Voor anti-fraude-detectie bewaart Cards Center het IP-adres van elk bod gedurende
            maximaal <strong>{BID_IP_RETENTION_DAYS} dagen</strong>, waarna het wordt geanonimiseerd. Login-IP&apos;s
            worden bij elke nieuwe sessie overschreven en niet historisch bewaard.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">Artikel 14 — Escrow en uitbetaling Verkoper</h2>
          <p className="mb-2">
            <strong>14.1.</strong> Het door de Bieder betaalde bedrag wordt door Cards Center in escrow gehouden tot
            de levering door de Bieder is bevestigd, dan wel de auto-confirm-termijn (30 dagen na verzending) is
            verstreken zonder bezwaar.
          </p>
          <p>
            <strong>14.2.</strong> Na release van escrow wordt het bedrag minus eventuele commissie uitgekeerd op het
            saldo van de Verkoper. Commissie wordt geheven op basis van het abonnement van de Verkoper en is
            transparant getoond bij het aanmaken van de veiling.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">Artikel 15 — Verzending, ophalen en levering</h2>
          <p className="mb-2">
            <strong>15.1.</strong> De Verkoper is gehouden binnen 14 dagen na ontvangst van de betaling het kavel te
            verzenden of, bij PICKUP-veilingen, beschikbaar te stellen voor ophaling. Bij gebreke daarvan wordt de
            koopovereenkomst automatisch ontbonden en wordt het volledige aankoopbedrag aan de Bieder gerestitueerd.
          </p>
          <p>
            <strong>15.2.</strong> De Bieder is verplicht een door hem gekochte zending in ontvangst te nemen, dan wel
            binnen de overeengekomen ophaal-reservering (14 dagen) op te halen. Niet-ophalen leidt tot ontbinding van
            de overeenkomst en kan tot een schorsingsstrike leiden indien herhaaldelijk.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">Artikel 16 — Geschillen tussen Verkoper en Bieder</h2>
          <p className="mb-2">
            <strong>16.1.</strong> Geschillen over conditie, levering of beschadiging worden in eerste instantie
            tussen Verkoper en Bieder afgehandeld via het ingebouwde geschillen-systeem. Bieder en Verkoper hebben
            beide de mogelijkheid een geschil te openen of te escaleren naar Cards Center binnen de daarvoor geldende
            termijnen.
          </p>
          <p>
            <strong>16.2.</strong> Indien partijen niet zelf tot een oplossing komen, beslist Cards Center op basis
            van het beschikbare bewijs. De beslissing van Cards Center is bindend op platform-niveau, doch laat de
            mogelijkheid om een civielrechtelijke procedure te starten onverlet.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">Artikel 17 — Annulering en wijzigingen door Verkoper</h2>
          <p className="mb-2">
            <strong>17.1.</strong> Een veiling kan door de Verkoper worden geannuleerd zolang er nog geen biedingen
            zijn uitgebracht. Na het eerste bod is annulering alleen mogelijk in uitzonderlijke gevallen (bv. verlies
            of beschadiging van het kavel) en alleen na expliciete goedkeuring van Cards Center.
          </p>
          <p>
            <strong>17.2.</strong> Onrechtmatige annulering door de Verkoper na biedingen kan leiden tot een schorsing
            en restitutie van eventuele reserveringen aan de Bieders.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">Artikel 18 — Verwerking persoonsgegevens</h2>
          <p>
            Cards Center verwerkt persoonsgegevens van Bieders en Verkopers voor zover noodzakelijk voor de uitvoering
            van de veiling, fraudepreventie (waaronder anti-shill bidding zoals beschreven in Artikel 13), wettelijke
            verplichtingen en relevante geschillenbeslechting. Voor het overige verwijzen wij naar het privacy-statement
            van Cards Center.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">Artikel 19 — Wijzigingen voorwaarden</h2>
          <p>
            Cards Center kan deze voorwaarden eenzijdig wijzigen. Wijzigingen worden ten minste 14 dagen voor
            inwerkingtreding aangekondigd via het platform. Voor lopende veilingen blijven de voorwaarden gelden zoals
            die van kracht waren op het moment van het bieden.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">Artikel 20 — Slotbepaling</h2>
          <p>
            Indien een bepaling van deze voorwaarden nietig of vernietigbaar blijkt, blijven de overige bepalingen
            onverminderd van kracht. Cards Center en de wederpartij zullen de nietige of vernietigbare bepaling in
            overleg vervangen door een bepaling die de strekking van de oorspronkelijke bepaling zo dicht mogelijk
            benadert.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-muted/30 p-5">
          <h2 className="mb-2 text-base font-bold">
            Samenvatting — wanneer krijg je geld terug, wanneer ben je het kwijt?
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            <strong>Reserveringen zijn tijdelijk zolang je je afspraken nakomt:</strong> ze vallen vrij zodra je bod
            niet meer actief is (overboden, veiling afgelopen) en tellen mee in je betaling als je wint. Geld is alleen
            permanent verloren bij wanbetaling — win je een veiling en betaal je niet binnen 5 dagen, dan verbeurt de{" "}
            {RESERVE_PERCENTAGE_DISPLAY}-reservering als borg en betaal je {FAILURE_FEE_DISPLAY} wanbetalingskosten,
            ongeacht het bedrag.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted text-left text-foreground">
                <tr>
                  <th className="border border-border px-2 py-1.5 font-semibold">Scenario</th>
                  <th className="border border-border px-2 py-1.5 font-semibold">Reservering</th>
                  <th className="border border-border px-2 py-1.5 font-semibold">Borg</th>
                  <th className="border border-border px-2 py-1.5 font-semibold">Saldo-effect</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr>
                  <td className="border border-border px-2 py-1.5">Je wordt overboden</td>
                  <td className="border border-border px-2 py-1.5">Valt direct vrij</td>
                  <td className="border border-border px-2 py-1.5">n.v.t.</td>
                  <td className="border border-border px-2 py-1.5 text-emerald-700 dark:text-emerald-400">Niets verloren</td>
                </tr>
                <tr>
                  <td className="border border-border px-2 py-1.5">Veiling eindigt zonder dat je hebt gewonnen</td>
                  <td className="border border-border px-2 py-1.5">Valt vrij bij ENDED</td>
                  <td className="border border-border px-2 py-1.5">n.v.t.</td>
                  <td className="border border-border px-2 py-1.5 text-emerald-700 dark:text-emerald-400">Niets verloren</td>
                </tr>
                <tr>
                  <td className="border border-border px-2 py-1.5">Je wint en betaalt 100% direct</td>
                  <td className="border border-border px-2 py-1.5">Verrekend in betaling</td>
                  <td className="border border-border px-2 py-1.5">n.v.t.</td>
                  <td className="border border-border px-2 py-1.5">Aankoopbedrag afgeschreven</td>
                </tr>
                <tr>
                  <td className="border border-border px-2 py-1.5">
                    Je wint, hebt minder dan 100% saldo, betaalt binnen 5 dagen
                  </td>
                  <td className="border border-border px-2 py-1.5">
                    Reserve telt mee in betaling
                  </td>
                  <td className="border border-border px-2 py-1.5">n.v.t.</td>
                  <td className="border border-border px-2 py-1.5">
                    Restbedrag afgeschreven bij completePayment
                  </td>
                </tr>
                <tr>
                  <td className="border border-border px-2 py-1.5">
                    Je wint maar mist de 5-dagen-betaaltermijn
                  </td>
                  <td className="border border-border px-2 py-1.5 font-semibold text-red-700 dark:text-red-400">
                    Verbeurt als borg
                  </td>
                  <td className="border border-border px-2 py-1.5 font-semibold text-red-700 dark:text-red-400">
                    {RESERVE_PERCENTAGE_DISPLAY} van bod + veilingkosten
                  </td>
                  <td className="border border-border px-2 py-1.5 text-red-700 dark:text-red-400">
                    Borg + {FAILURE_FEE_DISPLAY} kosten afgeboekt, +1 strike
                  </td>
                </tr>
                <tr>
                  <td className="border border-border px-2 py-1.5">
                    Je account wordt opgeheven met actieve bids
                  </td>
                  <td className="border border-border px-2 py-1.5">Valt vrij</td>
                  <td className="border border-border px-2 py-1.5">n.v.t.</td>
                  <td className="border border-border px-2 py-1.5 text-emerald-700 dark:text-emerald-400">
                    Niets verloren
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <p className="pt-4 text-xs text-muted-foreground">
          Deze voorwaarden zijn opgesteld op 2026-05-04. Bij vragen kun je contact opnemen via support.
        </p>
      </div>
    </PageContainer>
  );
}
