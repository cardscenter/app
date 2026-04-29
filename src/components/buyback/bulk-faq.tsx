import { HelpCircle, ChevronDown } from "lucide-react";
import { Link } from "@/i18n/navigation";

// Copy is kept inline in Dutch (no i18n) because the FAQ content is customer-
// support style copy that evolves without translation review. Moving to i18n
// later is mechanical: wrap each string in `t("faq.<key>")`.
const FAQ_ITEMS: { q: string; a: string | React.ReactNode }[] = [
  {
    q: "Waar stuur ik de bulk naartoe?",
    a: (
      <p>
        Direct na het indienen van je aanvraag krijg je het verzendadres en de complete verpakkingsinstructies te zien. Diezelfde pagina vind je terug via je dashboard onder &quot;Verpakkingsinstructies&quot; — je kunt hem altijd nog eens raadplegen. Verstuur binnen <strong>5 dagen</strong> na indienen, zodat we je bulk vlot kunnen verwerken.
      </p>
    ),
  },
  {
    q: "Wat is de minimale hoeveelheid kaarten die ik kan opsturen?",
    a: "Er is geen vast minimum aantal kaarten, wél een minimale inkoopwaarde van €30. De calculator laat realtime zien hoever je nog verwijderd bent van dat bedrag.",
  },
  {
    q: "Wat als ik een verkeerde hoeveelheid kaarten invoer?",
    a: "De calculator geeft een schatting. Bij ontvangst tellen wij de kaarten zorgvuldig na en zien admins per categorie de werkelijk goedgekeurde aantallen. De definitieve uitbetaling komt op basis daarvan — die kan dus hoger of lager uitvallen dan je oorspronkelijke schatting. Je ziet de definitieve berekening terug in je dashboard zodra de inspectie is afgerond.",
  },
  {
    q: "Waarbij horen Ascended Heroes (ASC) Reverse Holo's?",
    a: "Die vul je in bij de reguliere Reverse Holo-categorie. Zowel de Energy Reverse Holo's als de Ball Reverse Holo's uit Ascended Heroes vallen daaronder.",
  },
  {
    q: "Hoe moet ik mijn bulk verpakken?",
    a: (
      <p>
        We hebben een uitgebreid stappenplan met verzendadres, vervoerders-tarieven en tips:{" "}
        <Link
          href="/verkoop-calculator/verpakken"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
        >
          bekijk de verpakkingsinstructies
        </Link>
        . Korte samenvatting: stevige doos, kaarten in plastic zakjes per categorie (geen sleeves nodig voor commons/uncommons/rares/holo's/reverse holo's), lege ruimte opvullen, stevig dichttapen.
      </p>
    ),
  },
  {
    q: "Moet ik mijn kaarten in sleeves doen?",
    a: "Nee, voor bulk hoef je commons, uncommons, rares, holo's en reverse holo's NIET in sleeves te doen. Plastic zakjes per categorie zijn voldoende. Bij Ultra Rares mag je ze wel sleeven als je extra zekerheid wilt — dat is optioneel.",
  },
  {
    q: "Wie betaalt de verzendkosten?",
    a: "De verzendkosten en het versturen van het pakket zijn volledig de verantwoordelijkheid van de afzender. Je bent ook zelf verantwoordelijk voor het veilig verpakken. Gebruik bij voorkeur een traceerbare verzendoptie en vul de Track & Trace-code in via je dashboard.",
  },
  {
    q: "Wanneer moet ik mijn pakket verzenden?",
    a: "Binnen 5 dagen na het indienen van je aanvraag. Bulk-prijzen zijn vaste tarieven per categorie en veranderen niet, maar we vragen om snelle verzending zodat we je bulk vlot kunnen inspecteren en uitbetalen. In je dashboard zie je een countdown tot de deadline.",
  },
  {
    q: "Moet er een afzendadres op het pakket staan?",
    a: "Ja, dat is verplicht. Zonder duidelijk afzendadres op de doos én een briefje met je naam erbinnen kunnen we de zending niet aan je aanvraag koppelen — en dus ook geen uitbetaling doen. Geef daarnaast je Track & Trace-code op via je dashboard zodat we de zending alvast kunnen herkennen.",
  },
  {
    q: "Hoe lang duurt het voordat ik mijn geld krijg?",
    a: "We streven naar uitbetaling binnen 24 uur na ontvangst en controle. Bij grote hoeveelheden (duizenden kaarten) kan het tot 48 uur duren. Je krijgt altijd per e-mail een update zodra de verwerking is afgerond.",
  },
  {
    q: "Kan ik mijn bulk verkopen voor tegoed in plaats van geld?",
    a: "Ja. Kies je voor tegoed in plaats van uitbetaling in geld, dan krijg je 5% extra waarde bovenop het bedrag. Dat tegoed kun je op Cards Center gebruiken voor losse kaarten, gesealde producten en meer.",
  },
  {
    q: "Wat gebeurt er als mijn bulk niet voldoet aan de eisen?",
    a: (
      <div className="space-y-2">
        <p>
          Als de bulk niet voldoet (bv. veel beschadigde kaarten) nemen we contact op en heb je twee opties:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Retourzending</strong> — €10,95 per pakket, vooraf te betalen.
          </li>
          <li>
            <strong>Aanpassen van de prijs</strong> — we berekenen opnieuw op basis van de kaarten die wél voldoen.
          </li>
        </ul>
      </div>
    ),
  },
  {
    q: "Wat is het verschil tussen Basic Energy en Special Energy?",
    a: (
      <div className="space-y-2">
        <p>
          <strong>Basic Energy</strong> is ongenummerd of draagt een nummer als SVE001-008, met &quot;Basic Energy&quot; bovenaan. Die vinden je in elke Booster Pack.
        </p>
        <p>
          <strong>Special Energy</strong> hoort bij een specifieke set en heeft een zetnummer. Herkenbaar aan &quot;Special Energy&quot; in de linkerbovenhoek.
        </p>
      </div>
    ),
  },
];

export function BulkFaq() {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <HelpCircle className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-bold text-foreground">Veelgestelde vragen</h2>
      </div>
      <div className="space-y-2">
        {FAQ_ITEMS.map((item, i) => (
          <details
            key={i}
            className="group rounded-xl border border-border bg-card transition-colors open:border-primary/40"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/40">
              <span>{item.q}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-border/50 px-4 py-3 text-sm text-muted-foreground">
              {item.a}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
