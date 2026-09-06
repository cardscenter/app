import { Link } from "@/i18n/navigation";
import {
  BUYBACK_RATE,
  MAX_BUYBACK_MARKTPRIJS,
  MINIMUM_COLLECTION_VALUE,
} from "@/lib/buyback-pricing";
import type { BuybackFaqItem } from "./buyback-faq";

const RATE = `${Math.round(BUYBACK_RATE * 100)}%`;
const MAX = `€${MAX_BUYBACK_MARKTPRIJS.toFixed(2).replace(".", ",")}`;
const MIN = `€${MINIMUM_COLLECTION_VALUE.toFixed(2).replace(".", ",")}`;

const LINK_CLASS = "font-medium text-primary underline underline-offset-2 hover:text-primary/80";

// FAQ voor losse kaarten (collectie-calculator). Hardcoded NL, zelfde
// conventie als bulk-faq.tsx. Bedragen komen uit buyback-pricing zodat een
// tariefwijziging hier automatisch doorwerkt.
export const COLLECTION_FAQ_ITEMS: BuybackFaqItem[] = [
  {
    q: "Hoe wordt de inkoopprijs van een losse kaart bepaald?",
    a: `We betalen ${RATE} van de actuele Marktprijs — dezelfde prijs die je op elke kaartpagina in onze database ziet. De calculator toont direct per kaart wat je ontvangt. De prijs is een schatting: na ontvangst controleren we de kaart en de actuele marktdata en bevestigen we het definitieve bedrag.`,
  },
  {
    q: "Waarom kan ik commons, uncommons en rares niet als losse kaart verkopen?",
    a: (
      <p>
        Die rariteiten hebben per stuk te weinig waarde om individueel te beoordelen. Ze gaan via de{" "}
        <Link href="/verkopen/bulk" className={LINK_CLASS}>
          bulk-calculator
        </Link>{" "}
        tegen vaste tarieven per categorie — dat is voor jou én voor ons sneller. Moderne rare-varianten zoals V, VMAX, VSTAR, ex en Illustration Rares kunnen wél als losse kaart.
      </p>
    ),
  },
  {
    q: `Waarom is er een maximum van ${MAX} Marktprijs per kaart?`,
    a: "Boven dat bedrag wordt de prijs sterk bepaald door conditie en grading, en dat kunnen we niet betrouwbaar op afstand beoordelen. Duurdere kaarten verkoop je beter zelf via de marktplaats of een veiling op Cards Center — daar bepaal jij de prijs.",
  },
  {
    q: "Wat betekent Near Mint precies?",
    a: "Near Mint (NM) betekent: geen zichtbare slijtage aan randen of hoeken, geen krassen op het oppervlak of de holo, geen witte plekjes op de achterkant en geen duidelijk off-center print. Een kaart die uit een booster komt en direct in een sleeve is gegaan, is doorgaans Near Mint. Twijfel je? Kies dan een lagere conditie in de calculator — je ziet dan meteen dat we die kaart niet kunnen inkopen en voorkomt een afkeuring.",
  },
  {
    q: "Wat gebeurt er als een kaart bij controle niet Near Mint blijkt?",
    a: "Dan stellen we een prijscorrectie voor: je ziet in je dashboard per kaart de reden en het nieuwe bedrag, en je kiest zelf of je akkoord gaat. Ga je niet akkoord, dan sturen we de kaarten retour (retourkosten €10,95 per pakket). Je krijgt hierover altijd een e-mail.",
  },
  {
    q: "Welke sets en talen kopen jullie in?",
    a: "Alleen Engelstalige, originele kaarten uit de XY-serie (februari 2014) en nieuwer. Oudere sets hebben te onbetrouwbare marktprijzen om automatisch in te kopen.",
  },
  {
    q: "Is er een minimum?",
    a: `Ja, een minimale inkoopwaarde van ${MIN} per aanvraag. Er is geen minimum aantal kaarten.`,
  },
  {
    q: "Hoe verpak ik losse kaarten?",
    a: (
      <p>
        Elke kaart in een sleeve en een toploader (of tussen twee stevige kartonnetjes), samen in een bubbeltjesenvelop of doosje. Voeg een briefje met je naam toe en zet je afzendadres op het pakket. Verstuur aangetekend en verzekerd — het pakket is jouw verantwoordelijkheid tot het bij ons is. Het volledige stappenplan met verzendadres staat op de{" "}
        <Link href="/verkopen/verpakken" className={LINK_CLASS}>
          verpakkingsinstructies
        </Link>
        .
      </p>
    ),
  },
];
