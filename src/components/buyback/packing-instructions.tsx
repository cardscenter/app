import {
  MapPin,
  Mail,
  AlertTriangle,
  Lightbulb,
  Package,
  Truck,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

// Single source of truth for the bulk-buyback packing guide. Used after
// submission (BuybackSuccess) and on the standalone /verkoop-calculator/
// verpakken page so users can revisit it from their dashboard.

const CARRIER_TABLE: { carrier: string; service: string; spec: string; price: string }[] = [
  { carrier: "PostNL", service: "Klein pakket",       spec: "3 kg / 34×28×12 cm",   price: "€5,95" },
  { carrier: "PostNL", service: "Gemiddeld pakket",   spec: "10 kg / 100×50×50 cm", price: "€6,95" },
  { carrier: "PostNL", service: "Groot pakket",       spec: "23 kg / 176×78×58 cm", price: "€13,90" },
  { carrier: "PostNL", service: "Aangetekend",        spec: "+ €3,30 toeslag",      price: "+ €3,30" },
  { carrier: "DPD",    service: "2Home",              spec: "10 kg / 175 cm lang",  price: "€6,25" },
  { carrier: "DPD",    service: "2Home",              spec: "20 kg / 175 cm lang",  price: "€10,00" },
  { carrier: "DHL",    service: "Standaard thuis",    spec: "10 kg / 80×50×35 cm",  price: "€6,45" },
  { carrier: "DHL",    service: "Standaard thuis",    spec: "20 kg / 80×50×35 cm",  price: "€10,95" },
  { carrier: "DHL",    service: "Aangetekend",        spec: "+ €2,50 toeslag",      price: "+ €2,50" },
  { carrier: "UPS",    service: "Pakket groot",       spec: "15 kg / tot 75.000 cm³",  price: "€13,87" },
  { carrier: "UPS",    service: "Pakket extra groot", spec: "20 kg / tot 100.000 cm³", price: "€13,87" },
];

export function PackingInstructions() {
  return (
    <div className="space-y-6">
      <ShippingAddressCard />
      <PackingStepsCard />
      <PackingTipsRow />
      <ShippingOptionsCard />
      <ExtraTipsCard />
      <ImportantWarningCard />
    </div>
  );
}

function ShippingAddressCard() {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-800/50 dark:bg-amber-950/20">
      <div className="mb-4 flex items-center gap-2">
        <MapPin className="h-5 w-5 text-amber-700 dark:text-amber-300" />
        <h2 className="text-lg font-bold text-amber-900 dark:text-amber-100">Verzendadres</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-amber-200 bg-white/60 p-4 dark:border-amber-800/40 dark:bg-amber-950/40">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            <MapPin className="h-3.5 w-3.5" /> Postadres
          </div>
          <address className="not-italic text-sm leading-relaxed text-amber-900 dark:text-amber-100">
            <p className="font-bold">Cards Center — Bulk</p>
            <p>Oude Drydijck 41</p>
            <p>4564CT Sint Jansteen</p>
            <p>Nederland</p>
          </address>
        </div>
        <div className="rounded-xl border border-amber-200 bg-white/60 p-4 dark:border-amber-800/40 dark:bg-amber-950/40">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            <Mail className="h-3.5 w-3.5" /> Contact
          </div>
          <p className="text-sm leading-relaxed text-amber-900 dark:text-amber-100">
            <strong>E-mail:</strong>{" "}
            <a className="underline underline-offset-2 hover:text-amber-700 dark:hover:text-amber-300" href="mailto:info@cards-center.nl">
              info@cards-center.nl
            </a>
          </p>
          <p className="mt-2 text-sm text-amber-800/90 dark:text-amber-200/90">
            <strong>Track &amp; Trace:</strong> vermeld dit e-mailadres bij je verzendlabel — dan ontvangen wij ook de tracking-code.
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-lg border-l-4 border-amber-400 bg-amber-100/70 p-3 text-xs text-amber-900 dark:border-amber-500 dark:bg-amber-900/30 dark:text-amber-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <strong>Let op:</strong> dit is een postadres en geen bezoek- of afleveradres. Stuur je pakket binnen <strong>5 dagen</strong> na het indienen van je aanvraag, zodat we je bulk vlot kunnen verwerken en je snel uitbetaling ontvangt.
        </span>
      </div>
    </section>
  );
}

function PackingStepsCard() {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <Package className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">Stappenplan: zo verpak je je bulk veilig</h2>
      </div>

      <div className="space-y-3">
        <PackingStep n={1} title="Verzamel het juiste verpakkingsmateriaal">
          <p className="mb-2">Voor een goede bulkzending heb je nodig:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Een stevige kartonnen doos</strong> — net groot genoeg voor je bulk, niet te ruim.</li>
            <li><strong>Plastic of cellofaanzakjes</strong> om stapels in te doen — eenvoudig te labelen met permanent marker.</li>
            <li><strong>Kartonnen tussenstukken</strong> (optioneel) voor extra stabiliteit.</li>
            <li><strong>Bubbeltjesplastic of opvulmateriaal</strong> — papiersnippers, schuim, opvulchips.</li>
            <li><strong>Zwarte permanent marker</strong> om zakjes te labelen.</li>
            <li><strong>PP-tape</strong> of andere sterke verpakkingstape.</li>
          </ul>
        </PackingStep>

        <PackingStep n={2} title="Sorteer de kaarten en bundel ze">
          <p className="mb-2">
            Maak stapels van <strong>maximaal 100 kaarten</strong> per categorie (Rares, Holo&apos;s, Reverse Holo&apos;s). Voor Common &amp; Uncommon is dit optioneel maar wel handig voor ons.
          </p>
          <div className="mb-3 flex items-start gap-2 rounded-lg border-l-4 border-emerald-400 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-500 dark:bg-emerald-900/20 dark:text-emerald-100">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Geen sleeves nodig.</strong> Common, Uncommon, Rare, Holo en Reverse Holo kaarten hoef je <strong>niet</strong> te sleeven — gewoon in plastic zakjes is prima zolang ze niet kunnen schuiven. Bij Ultra Rares mag dat wel als je extra zekerheid wilt.
            </span>
          </div>
          <p className="mb-1">Doe de kaarten in zakjes en label met permanent marker, bijvoorbeeld:</p>
          <ul className="mb-2 list-disc space-y-1 pl-5">
            <li><span className="font-mono">100x R</span> — Rares</li>
            <li><span className="font-mono">100x H</span> — Holo&apos;s</li>
            <li><span className="font-mono">50x RH</span> — Reverse Holo&apos;s (bij minder dan 100)</li>
          </ul>
          <p>Heb je ergens minder dan 100 kaarten van? Schrijf dan het exacte aantal op het zakje.</p>
        </PackingStep>

        <PackingStep n={3} title="Vul de verzenddoos">
          <p className="mb-2">
            Begin met een laag <strong>Common &amp; Uncommon</strong> kaarten op de bodem voor stabiliteit en verdeel het gewicht goed over de doos.
          </p>
          <p className="mb-2">
            <strong>Lege ruimtes opvullen is essentieel:</strong>
          </p>
          <ul className="mb-2 list-disc space-y-1 pl-5">
            <li><strong>Bubbeltjesplastic</strong> — wikkel kaarten of stapels extra in voor bescherming.</li>
            <li><strong>Opvulpapier, schuim of karton</strong> om te voorkomen dat de inhoud kan schuiven.</li>
          </ul>
          <p>
            Sluit de doos tijdelijk en schud zachtjes. Hoor je beweging? Voeg meer opvulmateriaal toe tot alles stevig vastzit.
          </p>
        </PackingStep>

        <PackingStep n={4} title="Sluit en beveilig de verzenddoos">
          <div className="mb-3 flex items-start gap-2 rounded-lg border-l-4 border-red-400 bg-red-50 p-3 text-xs text-red-900 dark:border-red-500 dark:bg-red-950/30 dark:text-red-100">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Vergeet de afzender niet!</strong> Zonder duidelijk afzendadres op de doos én een briefje met je naam erbinnen kunnen we de zending niet aan je aanvraag koppelen — en kunnen we ook geen uitbetaling doen.
            </span>
          </div>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Schrijf je naam zoals opgegeven bij de calculator</strong> op een papiertje en stop dat in het pakket. Zo weten we van wie de zending komt.</li>
            <li><strong>Vermeld een afzendadres op de doos</strong> — vereist door de meeste vervoerders en absoluut noodzakelijk voor onze administratie.</li>
            <li><strong>Tape de doos stevig dicht</strong>, vooral op hoeken en naden.</li>
            <li>Gebruik <strong>extra tape</strong> om te voorkomen dat de doos tijdens transport open kan gaan.</li>
          </ul>
        </PackingStep>

        <PackingStep n={5} title="Label aanmaken en verzenden">
          <p className="mb-2">
            Maak een verzendlabel via de website of app van de gekozen vervoerder. We adviseren een <strong>verzekerde en aangetekende verzending</strong> — het pakket is jouw verantwoordelijkheid totdat het bij ons is afgeleverd.
          </p>
          <p className="mb-2">
            Vul bij het label ons e-mailadres in:{" "}
            <a className="underline underline-offset-2 hover:text-primary" href="mailto:info@cards-center.nl">
              info@cards-center.nl
            </a>{" "}
            — dan ontvangen wij ook de Track &amp; Trace-code.
          </p>
          <p>Je kunt het pakket ook bij een postkantoor of verzendpunt aanbieden; daar helpen ze met het label.</p>
        </PackingStep>
      </div>
    </section>
  );
}

function PackingStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
          {n}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="mb-2 text-base font-semibold text-foreground">{title}</h3>
          <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>
        </div>
      </div>
    </div>
  );
}

function PackingTipsRow() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TipCard
        icon={<Lightbulb className="h-5 w-5" />}
        title="Tip: gebruik plastic zakjes"
        body="Gewone plastic zakjes of cellofaanzakjes zijn ideaal voor bulk. Ze zijn stevig, sluiten goed af en je kunt er makkelijk op schrijven met een permanent marker."
      />
      <TipCard
        icon={<Package className="h-5 w-5" />}
        title="Tip: kies de juiste doos"
        body="Een te grote doos betekent veel opvulmateriaal — en daarmee onnodig gewicht en kans op schuiven. Kies een doos die net groot genoeg is voor je bulk."
      />
    </div>
  );
}

function TipCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-amber-700 dark:text-amber-400">
        {icon}
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function ShippingOptionsCard() {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Truck className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">Verzendmogelijkheden</h2>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        Voor bulkzendingen met een relatief hoog gewicht (10-30 kg) zijn DHL of UPS vaak de beste optie qua prijs en betrouwbaarheid. Je kunt ook met PostNL meerdere pakketten versturen — voor de meeste verzenders prima werkbaar.
      </p>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left">Vervoerder &amp; methode</th>
              <th className="px-4 py-2.5 text-left">Max. gewicht &amp; afmeting</th>
              <th className="px-4 py-2.5 text-right">Prijs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {CARRIER_TABLE.map((row, i) => (
              <tr key={i} className="hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  <strong className="text-foreground">{row.carrier}</strong>
                  <span className="text-muted-foreground"> — {row.service}</span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{row.spec}</td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">{row.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs italic text-muted-foreground">
        De prijzen zijn indicaties en kunnen wijzigen — controleer altijd de actuele tarieven op de website van de vervoerder.
      </p>
    </section>
  );
}

function ExtraTipsCard() {
  const tips = [
    "Gebruik geen elastiekjes om stapels bij elkaar te houden — dat beschadigt de kaarten.",
    "Schrijf altijd je naam en e-mailadres op een briefje in het pakket. Zo koppelen we de zending sneller aan jou.",
    "Bij hele grote hoeveelheden (>10.000 kaarten) kun je beter meerdere dozen gebruiken. Twijfel je? Mail ons.",
    "Bewaar het verzendbewijs en de Track & Trace-code totdat we de verwerking hebben bevestigd.",
  ];
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-base font-bold text-foreground">Extra tips voor een soepele verwerking</h2>
      </div>
      <ol className="space-y-2 text-sm text-muted-foreground">
        {tips.map((tip, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {i + 1}
            </span>
            <span>{tip}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ImportantWarningCard() {
  return (
    <section className="rounded-2xl border-l-4 border-red-400 bg-red-50/60 p-5 dark:border-red-500/80 dark:bg-red-950/20">
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
        <h2 className="text-base font-bold text-red-900 dark:text-red-100">Belangrijk om te weten</h2>
      </div>
      <ul className="space-y-1.5 text-sm text-red-900/90 dark:text-red-100/90">
        <li>
          • <strong>Verzend binnen 5 dagen</strong> na het indienen van je aanvraag, zodat we je bulk snel kunnen inspecteren en uitbetalen.
        </li>
        <li>
          • <strong>Vergeet de afzender niet</strong> — vermeld een afzendadres op de doos én voeg een briefje met je naam toe. Zonder afzender kunnen we geen uitbetaling verrichten.
        </li>
        <li>
          • Het pakket is en blijft jouw verantwoordelijkheid totdat het bij ons is afgeleverd. We adviseren een <strong>verzekerde en aangetekende</strong> verzending.
        </li>
        <li>
          • Vul je <strong>Track &amp; Trace-code</strong> in via je dashboard zodat we de zending kunnen volgen.
        </li>
        <li>
          • Vragen? Mail naar{" "}
          <a className="underline underline-offset-2" href="mailto:info@cards-center.nl">
            info@cards-center.nl
          </a>.
        </li>
      </ul>
    </section>
  );
}
