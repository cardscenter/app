import { MapPin, Mail, AlertTriangle, Lightbulb, Package, ShieldCheck } from "lucide-react";
import { PLATFORM } from "@/lib/platform-config";
import { StoryRows, type StoryRow } from "@/components/ploy/story-rows";
import { TileQuad } from "@/components/ploy/tile-quad";
import { DataCard } from "@/components/ploy/data-card";
import { Panel } from "@/components/ploy/panel";
import { PunchCard } from "@/components/ploy/punch-card";
import { Pill } from "@/components/ploy/pill";
import { DisplayHeading } from "@/components/ploy/display-heading";
import { SectionHead } from "@/components/ploy/section-head";

// Single source of truth for the bulk-buyback packing guide. Used after
// submission (BuybackSuccess) and on the standalone /verkopen/verpakken
// page so users can revisit it from their dashboard. Design-pass Fase D:
// verzendadres als punch-card, het stappenplan als verhaalrijen, tips als
// tegels, vervoerders in een datakaart en de waarschuwingen in een roze paneel.
// Hardcoded NL (support-copy).

const CARRIER_TABLE: { carrier: string; service: string; spec: string; price: string }[] = [
  { carrier: "PostNL", service: "Klein pakket", spec: "3 kg / 34×28×12 cm", price: "€5,95" },
  { carrier: "PostNL", service: "Gemiddeld pakket", spec: "10 kg / 100×50×50 cm", price: "€6,95" },
  { carrier: "PostNL", service: "Groot pakket", spec: "23 kg / 176×78×58 cm", price: "€13,90" },
  { carrier: "PostNL", service: "Aangetekend", spec: "+ €3,30 toeslag", price: "+ €3,30" },
  { carrier: "DPD", service: "2Home", spec: "10 kg / 175 cm lang", price: "€6,25" },
  { carrier: "DPD", service: "2Home", spec: "20 kg / 175 cm lang", price: "€10,00" },
  { carrier: "DHL", service: "Standaard thuis", spec: "10 kg / 80×50×35 cm", price: "€6,45" },
  { carrier: "DHL", service: "Standaard thuis", spec: "20 kg / 80×50×35 cm", price: "€10,95" },
  { carrier: "DHL", service: "Aangetekend", spec: "+ €2,50 toeslag", price: "+ €2,50" },
  { carrier: "UPS", service: "Pakket groot", spec: "15 kg / tot 75.000 cm³", price: "€13,87" },
  { carrier: "UPS", service: "Pakket extra groot", spec: "20 kg / tot 100.000 cm³", price: "€13,87" },
];

const Note = ({ tone, children }: { tone: "green" | "pink"; children: React.ReactNode }) => (
  <div className="mt-4 flex items-start gap-2 rounded-[12px] p-3 text-sm text-[var(--foreground)]" style={{ background: tone === "green" ? "var(--pastel-green)" : "var(--pastel-pink)" }}>
    <ShieldCheck className="mt-0.5 size-4 shrink-0" />
    <span>{children}</span>
  </div>
);

const STEPS: StoryRow[] = [
  {
    title: "Verzamel het juiste verpakkingsmateriaal",
    color: "blue",
    text: (
      <>
        <p>Voor een goede bulkzending heb je nodig:</p>
        <ul>
          <li>
            <strong>Een stevige kartonnen doos</strong>, net groot genoeg voor je bulk, niet te ruim.
          </li>
          <li>
            <strong>Plastic of cellofaanzakjes</strong> om stapels in te doen, makkelijk te labelen met permanent marker.
          </li>
          <li>
            <strong>Kartonnen tussenstukken</strong> (optioneel) voor extra stabiliteit.
          </li>
          <li>
            <strong>Bubbeltjesplastic of opvulmateriaal</strong>: papiersnippers, schuim, opvulchips.
          </li>
          <li>
            <strong>Zwarte permanent marker</strong> om zakjes te labelen.
          </li>
          <li>
            <strong>PP-tape</strong> of andere sterke verpakkingstape.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Sorteer de kaarten en bundel ze",
    color: "yellow",
    text: (
      <>
        <p>
          Maak stapels van <strong>maximaal 100 kaarten</strong> per categorie (Rares, Holo&apos;s, Reverse Holo&apos;s). Voor Common en Uncommon is dit optioneel maar wel handig voor ons.
        </p>
        <Note tone="green">
          <strong>Geen sleeves nodig.</strong> Common, Uncommon, Rare, Holo en Reverse Holo kaarten hoef je niet te sleeven. Gewoon in plastic zakjes is prima zolang ze niet kunnen schuiven. Bij Ultra Rares mag het wel als je extra zekerheid wilt.
        </Note>
        <p className="mt-4">Doe de kaarten in zakjes en label ze met permanent marker, bijvoorbeeld:</p>
        <ul>
          <li>
            <span className="font-mono">100x R</span>: Rares
          </li>
          <li>
            <span className="font-mono">100x H</span>: Holo&apos;s
          </li>
          <li>
            <span className="font-mono">50x RH</span>: Reverse Holo&apos;s (bij minder dan 100)
          </li>
        </ul>
        <p className="mt-3">Heb je ergens minder dan 100 kaarten van? Schrijf dan het exacte aantal op het zakje.</p>
      </>
    ),
  },
  {
    title: "Vul de verzenddoos",
    color: "pink",
    text: (
      <>
        <p>
          Begin met een laag <strong>Common en Uncommon</strong> kaarten op de bodem voor stabiliteit en verdeel het gewicht goed over de doos.
        </p>
        <p className="mt-3">
          <strong>Lege ruimtes opvullen is essentieel:</strong>
        </p>
        <ul>
          <li>
            <strong>Bubbeltjesplastic</strong>: wikkel kaarten of stapels extra in voor bescherming.
          </li>
          <li>
            <strong>Opvulpapier, schuim of karton</strong> om te voorkomen dat de inhoud kan schuiven.
          </li>
        </ul>
        <p className="mt-3">Sluit de doos tijdelijk en schud zachtjes. Hoor je beweging? Voeg meer opvulmateriaal toe tot alles stevig vastzit.</p>
      </>
    ),
  },
  {
    title: "Sluit en beveilig de verzenddoos",
    color: "green",
    text: (
      <>
        <Note tone="pink">
          <strong>Vergeet de afzender niet!</strong> Zonder duidelijk afzendadres op de doos en een briefje met je naam erbinnen kunnen we de zending niet aan je aanvraag koppelen, en dus ook geen uitbetaling doen.
        </Note>
        <ul className="mt-4">
          <li>
            <strong>Schrijf je naam zoals opgegeven bij de calculator</strong> op een papiertje en stop dat in het pakket.
          </li>
          <li>
            <strong>Vermeld een afzendadres op de doos</strong>: vereist door de meeste vervoerders en nodig voor onze administratie.
          </li>
          <li>
            <strong>Tape de doos stevig dicht</strong>, vooral op hoeken en naden.
          </li>
          <li>
            Gebruik <strong>extra tape</strong> zodat de doos tijdens transport niet open kan gaan.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Label aanmaken en verzenden",
    color: "blue",
    text: (
      <>
        <p>
          Maak een verzendlabel via de website of app van de gekozen vervoerder. We adviseren een <strong>verzekerde en aangetekende verzending</strong>: het pakket is jouw verantwoordelijkheid totdat het bij ons is afgeleverd.
        </p>
        <p className="mt-3">
          Vul bij het label ons e-mailadres in:{" "}
          <a className="font-semibold text-[var(--primary)] hover:underline" href={`mailto:${PLATFORM.supportEmail}`}>
            {PLATFORM.supportEmail}
          </a>
          . Dan ontvangen wij ook de Track &amp; Trace-code.
        </p>
        <p className="mt-3">Je kunt het pakket ook bij een postkantoor of verzendpunt aanbieden; daar helpen ze met het label.</p>
      </>
    ),
  },
];

const EXTRA_TIPS = [
  "Gebruik geen elastiekjes om stapels bij elkaar te houden. Dat beschadigt de kaarten.",
  "Schrijf altijd je naam en e-mailadres op een briefje in het pakket. Zo koppelen we de zending sneller aan jou.",
  "Bij hele grote hoeveelheden (meer dan 10.000 kaarten) kun je beter meerdere dozen gebruiken. Twijfel je? Mail ons.",
  "Bewaar het verzendbewijs en de Track & Trace-code totdat we de verwerking hebben bevestigd.",
];

export function PackingInstructions() {
  return (
    <>
      <ShippingAddress />
      <section className="flex justify-center px-4 pt-12 sm:px-5 lg:px-6 lg:pt-16">
        <div className="w-full max-w-6xl">
          <SectionHead eyebrow="Stappenplan" eyebrowColor="blue" title="Zo verpak je je bulk veilig" intro="Vijf stappen van doos tot verzendlabel. Volg ze en je kaarten komen heel aan." />
        </div>
      </section>
      <StoryRows rows={STEPS} />
      <TileQuad
        items={[
          { title: "Tip: gebruik plastic zakjes", color: "yellow", animation: "rain", text: "Gewone plastic zakjes of cellofaanzakjes zijn ideaal voor bulk. Ze zijn stevig, sluiten goed af en je kunt er makkelijk op schrijven met een permanent marker." },
          { title: "Tip: kies de juiste doos", color: "blue", animation: "scan", text: "Een te grote doos betekent veel opvulmateriaal, en daarmee onnodig gewicht en kans op schuiven. Kies een doos die net groot genoeg is voor je bulk." },
        ]}
      />
      <section className="flex justify-center px-4 pb-12 sm:px-5 lg:px-6 lg:pb-16">
        <div className="grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <DataCard badge="Vervoerders" badgeColor="blue" title="Verzendmogelijkheden">
            <p className="cc-prose text-sm">Voor bulkzendingen met een relatief hoog gewicht (10 tot 30 kg) zijn DHL of UPS vaak de beste optie qua prijs en betrouwbaarheid. Met PostNL kun je ook meerdere pakketten versturen.</p>
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground)]/45">
                  <th className="px-3 py-2 text-left">Vervoerder</th>
                  <th className="hidden px-3 py-2 text-left sm:table-cell">Max. gewicht en afmeting</th>
                  <th className="px-3 py-2 text-right">Prijs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                {CARRIER_TABLE.map((row, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2.5">
                      <span className="font-semibold text-[var(--foreground)]">{row.carrier}</span>
                      <span className="text-[var(--foreground)]/55"> · {row.service}</span>
                      <span className="block text-xs text-[var(--foreground)]/55 sm:hidden">{row.spec}</span>
                    </td>
                    <td className="hidden px-3 py-2.5 text-[var(--foreground)]/65 sm:table-cell">{row.spec}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[var(--foreground)]">{row.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-[var(--foreground)]/55">De prijzen zijn indicaties en kunnen wijzigen. Controleer altijd de actuele tarieven op de website van de vervoerder.</p>
          </DataCard>
          <PunchCard className="bg-white p-6 sm:p-7" dot="var(--border)">
            <div className="flex items-center gap-2">
              <Lightbulb className="size-5 text-[var(--primary)]" />
              <h3 className="text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">Extra tips voor een soepele verwerking</h3>
            </div>
            <ol className="mt-4 space-y-3">
              {EXTRA_TIPS.map((tip, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-[var(--foreground)]/80">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)] text-[11px] font-bold text-white">{i + 1}</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ol>
          </PunchCard>
        </div>
      </section>
      <Panel color="pink" padding="sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-16">
          <div className="lg:w-[36%]">
            <Pill color="pink">
              <AlertTriangle className="size-3" /> Belangrijk
            </Pill>
            <DisplayHeading tag="h2" size={4} text="Goed om te weten" className="mt-4" />
          </div>
          <ul className="flex-1 space-y-3 text-base text-[var(--foreground)]">
            <li>
              <strong>Verzend binnen 5 dagen</strong> na het indienen van je aanvraag, zodat we je bulk snel kunnen inspecteren en uitbetalen.
            </li>
            <li>
              <strong>Vergeet de afzender niet.</strong> Vermeld een afzendadres op de doos en voeg een briefje met je naam toe. Zonder afzender kunnen we geen uitbetaling doen.
            </li>
            <li>
              Het pakket is en blijft jouw verantwoordelijkheid totdat het bij ons is afgeleverd. We adviseren een <strong>verzekerde en aangetekende</strong> verzending.
            </li>
            <li>
              Vul je <strong>Track &amp; Trace-code</strong> in via je dashboard zodat we de zending kunnen volgen.
            </li>
            <li>
              Vragen? Mail naar{" "}
              <a className="font-semibold underline underline-offset-2" href={`mailto:${PLATFORM.supportEmail}`}>
                {PLATFORM.supportEmail}
              </a>
              .
            </li>
          </ul>
        </div>
      </Panel>
    </>
  );
}

function ShippingAddress() {
  return (
    <section className="flex justify-center px-4 sm:px-5 lg:px-6">
      <div className="grid w-full max-w-6xl gap-4 md:grid-cols-2">
        <PunchCard className="bg-white p-6 sm:p-7" dot="var(--border)">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground)]/50">
            <MapPin className="size-3.5" /> Postadres
          </div>
          <address className="mt-4 not-italic text-lg leading-snug text-[var(--foreground)]">
            <p className="font-semibold">{PLATFORM.legalName} · Bulk</p>
            <p>
              {PLATFORM.address.street} {PLATFORM.address.houseNumber}
            </p>
            <p>
              {PLATFORM.address.postalCode} {PLATFORM.address.city}
            </p>
            <p>{PLATFORM.address.country}</p>
          </address>
          <p className="mt-4 flex items-start gap-2 rounded-[12px] bg-[var(--pastel-yellow)] p-3 text-xs text-[var(--foreground)]">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Dit is een postadres, geen bezoek- of afleveradres. Stuur je pakket binnen <strong>5 dagen</strong> na het indienen van je aanvraag.
            </span>
          </p>
        </PunchCard>
        <PunchCard className="bg-white p-6 sm:p-7" dot="var(--border)">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground)]/50">
            <Mail className="size-3.5" /> Contact
          </div>
          <p className="mt-4 text-lg text-[var(--foreground)]">
            <a className="font-semibold text-[var(--primary)] hover:underline" href={`mailto:${PLATFORM.supportEmail}`}>
              {PLATFORM.supportEmail}
            </a>
          </p>
          <p className="cc-prose mt-3 text-sm">
            <strong className="font-semibold text-[var(--foreground)]">Track &amp; Trace:</strong> vermeld dit e-mailadres bij je verzendlabel, dan ontvangen wij ook de tracking-code.
          </p>
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-[var(--foreground)]/70">
            <Package className="size-4" /> Vragen over je zending beantwoorden we binnen twee werkdagen.
          </p>
        </PunchCard>
      </div>
    </section>
  );
}
