/**
 * Notificatie-weergave (Fase 44) — client-safe helpers voor de meldingen-
 * pagina, de bell-popover en de detail-modal.
 *
 * - `localizeNotificationLink`: DB-links zijn historisch inconsistent
 *   (deels met "/nl/"-prefix uit cron-jobs, deels zonder uit actions).
 *   Locale-loze paden gaven 404 via next/link. Hier normaliseren we ze
 *   allemaal naar één locale-prefixed pad — geen DB-migratie nodig.
 * - `resolveNotificationMeta`: kleur + icoon + categorie per melding.
 *   Kleurentaal volgt de site-branding: veilingen = blauw, claimsales =
 *   amber, marktplaats = groen; verder rose voor annuleringen/geschillen,
 *   violet voor inkoop, emerald voor geld-ontvangen, sky voor berichten.
 * - `buildNotificationDetail`: uitgebreide uitleg per melding voor de
 *   detail-popup. Subgevallen worden op titel-keywords herkend (het
 *   `type`-veld is te grof — "NEW_MESSAGE" dekt ook annuleringsverzoeken
 *   en betaaltermijnen).
 *
 * Teksten zijn bewust hardcoded NL: de notificatie-inhoud zelf (title/body
 * in de DB) is ook NL. Bij een echte EN-rollout migreert dit samen met de
 * createNotification-callsites.
 */

import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CalendarDays,
  Gavel,
  HandCoins,
  Heart,
  MessageCircle,
  Package,
  Scale,
  ShieldCheck,
  Store,
  Tag,
  Wallet,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Link-normalisatie                                                    */
/* ------------------------------------------------------------------ */

/** Strip een eventueel hardcoded locale-prefix ("/nl/..." of "/en/..."). */
export function normalizeNotificationLink(link: string | null): string | null {
  if (!link) return null;
  const stripped = link.replace(/^\/(nl|en)(?=\/|$)/, "");
  return stripped === "" ? "/" : stripped;
}

/** Genormaliseerd pad mét actieve locale — veilig voor next/link. */
export function localizeNotificationLink(link: string | null, locale: string): string | null {
  const normalized = normalizeNotificationLink(link);
  if (!normalized) return null;
  return `/${locale}${normalized}`;
}

/* ------------------------------------------------------------------ */
/* Kleur / icoon / categorie                                            */
/* ------------------------------------------------------------------ */

export type NotificationTone =
  | "blue"
  | "amber"
  | "emerald"
  | "rose"
  | "violet"
  | "sky"
  | "slate";

export const NOTIFICATION_TONE_CLASSES: Record<
  NotificationTone,
  { iconWrap: string; pill: string; headerBar: string; dot: string }
> = {
  blue: {
    iconWrap: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    pill: "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    headerBar: "bg-blue-500/10",
    dot: "bg-blue-500",
  },
  amber: {
    iconWrap: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    pill: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    headerBar: "bg-amber-500/10",
    dot: "bg-amber-500",
  },
  emerald: {
    iconWrap: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    pill: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    headerBar: "bg-emerald-500/10",
    dot: "bg-emerald-500",
  },
  rose: {
    iconWrap: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    pill: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    headerBar: "bg-rose-500/10",
    dot: "bg-rose-500",
  },
  violet: {
    iconWrap: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    pill: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    headerBar: "bg-violet-500/10",
    dot: "bg-violet-500",
  },
  sky: {
    iconWrap: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    pill: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    headerBar: "bg-sky-500/10",
    dot: "bg-sky-500",
  },
  slate: {
    iconWrap: "bg-muted text-muted-foreground",
    pill: "border-border bg-muted text-muted-foreground",
    headerBar: "bg-muted/50",
    dot: "bg-slate-400",
  },
};

export type NotificationLike = {
  type: string;
  title: string;
  body: string;
  link: string | null;
};

export type NotificationMeta = {
  tone: NotificationTone;
  icon: LucideIcon;
  category: string;
};

/**
 * Kleur + icoon + categorie voor een melding. Type eerst, daarna verfijnt
 * de link naar de juiste sale-branding (veiling/claimsale/marktplaats)
 * omdat generieke types als ORDER_* over alle drie de flows gaan.
 */
export function resolveNotificationMeta(n: NotificationLike): NotificationMeta {
  const link = normalizeNotificationLink(n.link) ?? "";
  const title = n.title.toLowerCase();

  // Geschillen en annuleringen: altijd rose, ongeacht sale-type.
  if (n.type.startsWith("DISPUTE_")) {
    return { tone: "rose", icon: Scale, category: "Geschillen" };
  }
  if (n.type === "ORDER_CANCELLED" || title.includes("annuler")) {
    return { tone: "rose", icon: Package, category: "Annulering" };
  }
  if (title.includes("betaaltermijn verlopen")) {
    return { tone: "rose", icon: Wallet, category: "Financieel" };
  }

  // Sale-type branding op basis van de link.
  if (link.includes("/veilingen") || link.includes("/biedingen")) {
    return { tone: "blue", icon: Gavel, category: "Veilingen" };
  }
  if (link.includes("/claimsales")) {
    return { tone: "amber", icon: Tag, category: "Claimsales" };
  }
  if (link.includes("/marktplaats")) {
    return { tone: "emerald", icon: Store, category: "Marktplaats" };
  }

  switch (n.type) {
    case "OUTBID":
    case "AUCTION_WON":
    case "AUCTION_WIN":
      return { tone: "blue", icon: Gavel, category: "Veilingen" };
    case "ORDER_REFUND":
      return { tone: "violet", icon: Wallet, category: "Financieel" };
    case "ORDER_PAID":
    case "ITEM_SOLD":
      return { tone: "emerald", icon: Package, category: "Verkopen" };
    case "ORDER_COMPLETED":
    case "ORDER_AUTO_CONFIRMED":
      return { tone: "emerald", icon: Package, category: "Bestellingen" };
    case "NEW_MESSAGE":
      return { tone: "sky", icon: MessageCircle, category: "Berichten" };
    case "WATCHLIST_ENDING":
      return { tone: "blue", icon: Heart, category: "Volglijst" };
    case "VERIFICATION_APPROVED":
      return { tone: "emerald", icon: ShieldCheck, category: "Verificatie" };
    case "VERIFICATION_REJECTED":
      return { tone: "rose", icon: ShieldCheck, category: "Verificatie" };
    case "ACCOUNT_UPDATE":
      return { tone: "slate", icon: ShieldCheck, category: "Account" };
    case "ADMIN_TASK":
      return { tone: "slate", icon: Bell, category: "Beheer" };
    case "TRUSTED_ORGANIZER":
      return { tone: "emerald", icon: CalendarDays, category: "Evenementen" };
    default:
      if (n.type.startsWith("BUYBACK_")) {
        return { tone: "violet", icon: HandCoins, category: "Collectie inkoop" };
      }
      if (n.type.startsWith("EVENT_")) {
        return { tone: "slate", icon: CalendarDays, category: "Evenementen" };
      }
      if (n.type.startsWith("ORDER_")) {
        return { tone: "emerald", icon: Package, category: "Bestellingen" };
      }
      return { tone: "slate", icon: Bell, category: "Melding" };
  }
}

/* ------------------------------------------------------------------ */
/* Detail-uitleg                                                        */
/* ------------------------------------------------------------------ */

export type NotificationDetail = {
  /** "Wat betekent dit?" — uitgebreide uitleg in alinea's. */
  paragraphs: string[];
  /** Optionele opsomming (regels, bedragen-uitleg, vervolgstappen). */
  bullets?: string[];
  /** Label voor de doorlink-knop, afgestemd op de bestemming. */
  linkLabel: string;
};

function linkLabelFor(link: string | null): string {
  const l = normalizeNotificationLink(link) ?? "";
  if (l.startsWith("/veilingen/")) return "Bekijk de veiling";
  if (l.startsWith("/claimsales/")) return "Bekijk de claimsale";
  if (l.startsWith("/marktplaats/")) return "Bekijk de advertentie";
  if (l.startsWith("/berichten")) return "Open het gesprek";
  if (l.startsWith("/dashboard/verkopen")) return "Naar verkooporders";
  if (l.startsWith("/dashboard/aankopen")) return "Naar aankopen";
  if (l.startsWith("/dashboard/biedingen")) return "Naar Live Hub";
  if (l.startsWith("/dashboard/saldo")) return "Naar saldo";
  if (l.startsWith("/dashboard/uitbetalingen")) return "Naar uitbetalingen";
  if (l.startsWith("/dashboard/inkoop")) return "Naar collectie inkoop";
  if (l.startsWith("/dashboard/volglijst")) return "Naar volglijst";
  if (l.startsWith("/dashboard/geschillen")) return "Naar het geschil";
  if (l.startsWith("/dashboard/verificatie")) return "Naar verificatie";
  if (l.startsWith("/dashboard/evenementen") || l.startsWith("/evenementen")) return "Naar evenementen";
  if (l.startsWith("/dashboard/claimsales")) return "Naar mijn claimsales";
  return "Bekijk pagina";
}

/**
 * Uitgebreide uitleg per melding. De originele body bevat de specifieke
 * bedragen/ordernummers — deze uitleg geeft daar de systeemcontext bij:
 * wat is er gebeurd, waarom, en wat kan/moet de gebruiker nu doen.
 */
export function buildNotificationDetail(n: NotificationLike): NotificationDetail {
  const title = n.title.toLowerCase();
  const body = n.body.toLowerCase();
  const linkLabel = linkLabelFor(n.link);

  /* --- Wanbetaling / boetes ------------------------------------- */
  if (title.includes("betaaltermijn verlopen") && (body.includes("wanbetaling") || body.includes("ingehouden"))) {
    return {
      paragraphs: [
        "Je hebt deze veiling gewonnen, maar het volledige bedrag is niet binnen de betaaltermijn van 5 dagen voldaan. Daarmee is de koop komen te vervallen en zijn de wanbetalingsregels toegepast. De exacte bedragen staan in de melding hierboven.",
        "De veiling schuift automatisch door naar de volgende bieder. Alle afschrijvingen zijn terug te vinden in je transactieoverzicht op de saldo-pagina.",
      ],
      bullets: [
        "Borg verbeurd: de 10%-reservering (10% van je bod plus veilingkosten) die bij het bieden op je saldo werd vastgezet, is ingehouden als borg. Dit geldt bij elke wanbetaling, ongeacht het bedrag.",
        "Wanbetalingskosten: daarnaast is 2,9% van het winnende bod als kosten ingehouden.",
        "Strike: er is één wanbetaling-strike op je account geregistreerd. Bij 2 strikes volgt een schorsing van 30 dagen, bij 3 strikes een permanente schorsing. Een strike vervalt automatisch na 365 dagen zonder nieuwe wanbetaling.",
        "Was je saldo niet toereikend, dan staat het restant als openstaande schuld en wordt het automatisch verrekend met je eerstvolgende inkomsten (storting, verkoop of terugbetaling).",
      ],
      linkLabel,
    };
  }

  /* --- Betaaltermijn verlopen (proposal/bundle, andere partij) --- */
  if (title.includes("betaaltermijn verlopen")) {
    return {
      paragraphs: [
        "Een betaling waar 5 dagen de tijd voor stond, is niet op tijd voldaan. De bijbehorende koop is daarmee vervallen.",
        "Was jij de verkoper? Dan staat je item weer actief en kan het opnieuw gekocht worden — je hoeft niets te doen. Was jij de koper, dan is de reservering op je saldo vrijgegeven en zijn eventuele kosten in de melding hierboven toegelicht.",
      ],
      linkLabel,
    };
  }

  /* --- Veiling gewonnen / gekocht -------------------------------- */
  if (n.type === "AUCTION_WON" || n.type === "AUCTION_WIN") {
    if (title.includes("aanbod om veiling over te nemen")) {
      return {
        paragraphs: [
          "De oorspronkelijke winnaar van deze veiling heeft niet betaald. Omdat jij de volgende hoogste bieder was, krijg je nu de kans om de veiling alsnog over te nemen voor je eigen bod.",
          "Je hebt 72 uur om te beslissen. Accepteer je, dan krijg je 5 dagen om te betalen (heb je voldoende saldo, dan wordt er direct betaald). Weigeren is volledig gratis en heeft geen enkel gevolg voor je account.",
        ],
        bullets: [
          "Accepteren: koop voor je eigen bod + 2,9% veilingkosten, met 5 dagen betaaltermijn.",
          "Weigeren of niet reageren binnen 72 uur: het aanbod gaat door naar de volgende bieder.",
        ],
        linkLabel,
      };
    }
    if (title.includes("wachten op betaling") || title.includes("betaling vereist")) {
      return {
        paragraphs: [
          "Gefeliciteerd — deze veiling is van jou! Je saldo was op het moment van winnen niet toereikend voor het volledige bedrag (bod + 2,9% veilingkosten), dus je hebt 5 dagen de tijd om je saldo aan te vullen en de betaling af te ronden.",
          "De 10%-reservering die bij het bieden werd vastgezet, telt gewoon mee in je betaling — je betaalt dus alleen het resterende deel bij.",
        ],
        bullets: [
          "Vul je saldo aan via een bankoverschrijving op de saldo-pagina en rond daarna de betaling af bij je aankopen.",
          "Let op: betaal je niet binnen 5 dagen, dan vervalt de koop, verbeurt de 10%-reservering als borg en betaal je 2,9% wanbetalingskosten plus een strike.",
        ],
        linkLabel,
      };
    }
    return {
      paragraphs: [
        "Gefeliciteerd met je gewonnen veiling! Het totaalbedrag bestaat uit je winnende bod plus 2,9% veilingkosten. Is er al betaald, dan staat het bedrag veilig in bewaring (escrow) tot jij de levering bevestigt — de verkoper krijgt het pas daarna uitbetaald.",
        "De verkoper verzendt je bestelling of neemt contact op over het ophaalmoment. Volg de status bij je aankopen.",
      ],
      linkLabel,
    };
  }

  /* --- Overboden -------------------------------------------------- */
  if (n.type === "OUTBID") {
    return {
      paragraphs: [
        "Iemand heeft een hoger bod geplaatst op deze veiling. De 10%-reservering van jouw bod is automatisch vrijgegeven op je saldo (tenzij je een automatisch bod hebt lopen dat nog kan verhogen).",
        "Wil je in de race blijven? Plaats een nieuw bod, of stel een automatisch bod in met je maximumbedrag — het systeem biedt dan voor je mee tot dat maximum.",
      ],
      linkLabel,
    };
  }

  /* --- Annuleringen ----------------------------------------------- */
  if (n.type === "ORDER_CANCELLED" || title.includes("geannuleerd")) {
    const sellerFault =
      body.includes("niet binnen 14 dagen") ||
      body.includes("zonder verzending") ||
      body.includes("niet verzonden");
    const wasBuyer = body.includes("teruggestort") || body.includes("terugbetaald");

    if (sellerFault) {
      return {
        paragraphs: [
          "Deze bestelling is geannuleerd omdat de verkoper de verzendtermijn van 14 dagen heeft overschreden. Dat kan doordat de koper zelf op annuleren heeft gedrukt (mogelijk vanaf dag 14), of doordat het systeem na 21 dagen zonder verzending automatisch heeft ingegrepen.",
          wasBuyer
            ? "Het volledige aankoopbedrag — inclusief verzendkosten, en bij een veiling ook de 2,9% veilingkosten — is teruggestort op je saldo. Je hoeft verder niets te doen."
            : "Het volledige bedrag is teruggestort aan de koper. Als verkoper wordt deze niet-nagekomen levering geregistreerd; bij herhaling kan dat gevolgen hebben voor je account.",
        ],
        bullets: wasBuyer
          ? [
              "De terugbetaling staat direct op je saldo — controleer het transactieoverzicht op de saldo-pagina.",
              "Je kunt het bedrag vrij gebruiken voor een nieuwe aankoop of laten uitbetalen naar je bankrekening.",
            ]
          : undefined,
        linkLabel,
      };
    }
    if (body.includes("wederzijds akkoord") || title.includes("annulering geaccepteerd")) {
      return {
        paragraphs: [
          "Deze bestelling is geannuleerd via wederzijds akkoord: één van beide partijen heeft een annuleringsverzoek ingediend en de ander heeft dat geaccepteerd.",
          "Het volledige bedrag — inclusief verzendkosten, en bij een veiling ook de 2,9% veilingkosten — is teruggestort op het saldo van de koper. De items staan weer beschikbaar voor verkoop.",
        ],
        linkLabel,
      };
    }
    return {
      paragraphs: [
        "Deze bestelling is geannuleerd. Het betaalde bedrag is volledig teruggestort op het saldo van de koper en de items zijn weer vrijgegeven.",
        "De precieze reden staat in de melding hierboven. Bekijk het transactieoverzicht op de saldo-pagina om de terugbetaling terug te vinden.",
      ],
      linkLabel,
    };
  }

  /* --- Annuleringsverzoeken (mutual flow) ------------------------- */
  if (title.includes("annuleringsverzoek ontvangen")) {
    return {
      paragraphs: [
        "De andere partij wil deze bestelling annuleren en heeft daarvoor jouw akkoord nodig. Je hebt 7 dagen om te reageren.",
        "Accepteer je het verzoek, dan wordt de bestelling geannuleerd en krijgt de koper het volledige bedrag terug. Wijs je het af, dan loopt de bestelling gewoon door — een reden opgeven is netjes maar niet verplicht.",
      ],
      bullets: [
        "Reageer je niet binnen 7 dagen, dan verloopt het verzoek vanzelf en blijft de bestelling staan.",
        "Let op (verkopers): een verlopen verzoek ontslaat je niet van je leverplicht — verzend je niet binnen 14 dagen, dan kan de koper alsnog direct annuleren.",
      ],
      linkLabel,
    };
  }
  if (title.includes("annuleringsverzoek afgewezen")) {
    return {
      paragraphs: [
        "De andere partij is niet akkoord gegaan met je annuleringsverzoek. De bestelling loopt gewoon door — de eventuele reden staat in de melding hierboven.",
        "Ben je koper en verzendt de verkoper vervolgens niet binnen 14 dagen na betaling, dan kun je alsnog zonder akkoord annuleren met volledige terugbetaling. Is er iets mis met een al geleverde bestelling, dan is een geschil de juiste route.",
      ],
      linkLabel,
    };
  }
  if (title.includes("annuleringsverzoek verlopen")) {
    return {
      paragraphs: [
        "Er is niet binnen 7 dagen gereageerd op het annuleringsverzoek, waardoor het automatisch is verlopen. De bestelling blijft gewoon staan.",
        "Voor de verkoper blijft de leverplicht volledig van kracht. Wordt er niet verzonden, dan kan de koper vanaf 14 dagen na betaling direct annuleren en grijpt het systeem uiterlijk na 21 dagen automatisch in met een volledige terugbetaling.",
      ],
      linkLabel,
    };
  }

  /* --- Terugbetalingen -------------------------------------------- */
  if (n.type === "ORDER_REFUND" || title.includes("terugbetaling")) {
    return {
      paragraphs: [
        "De verkoper heeft (een deel van) het aankoopbedrag aan je terugbetaald, bijvoorbeeld vanwege een ontbrekend of beschadigd item. Het exacte bedrag en de eventuele reden staan in de melding hierboven.",
        "Het bedrag staat direct op je saldo en is vrij te gebruiken of uit te betalen. Ben je het niet eens met de hoogte van de terugbetaling, neem dan eerst contact op met de verkoper via de chat; kom je er samen niet uit, dan kun je een geschil openen.",
      ],
      linkLabel,
    };
  }

  /* --- Bestelling betaald / verkocht ------------------------------ */
  if (n.type === "ORDER_PAID" || title.includes("nieuwe bestelling") || title.includes("bestelling uitgebreid")) {
    return {
      paragraphs: [
        "Er is een bestelling betaald. Het bedrag staat veilig in bewaring (escrow) bij Cards Center — de verkoper krijgt het pas uitbetaald nadat de koper de levering heeft bevestigd. Zo zijn beide partijen beschermd.",
        "Voor de verkoper: verzend binnen 14 dagen en voer de track & trace-code in bij je verkooporders. Verzend je niet op tijd, dan kan de koper de bestelling annuleren met volledige terugbetaling.",
      ],
      bullets: [
        "Verkoper: bij uitbetaling wordt alleen over de itemprijs commissie ingehouden (afhankelijk van je abonnement), niet over de verzendkosten.",
        "Koper: bevestig de levering zodra het pakket in orde is — na 30 dagen gebeurt dat automatisch.",
      ],
      linkLabel,
    };
  }
  if (n.type === "ITEM_SOLD" && !title.includes("reservering")) {
    return {
      paragraphs: [
        "Eén van je items is verkocht! Het aankoopbedrag staat in bewaring (escrow) en wordt aan je uitgebetaald zodra de koper de levering bevestigt — of automatisch 30 dagen na verzending.",
        "Verzend binnen 14 dagen en registreer de verzending met track & trace bij je verkooporders. Over de itemprijs wordt commissie ingehouden volgens je abonnement; verzendkosten worden volledig aan je doorbetaald.",
      ],
      linkLabel,
    };
  }
  if (title.includes("reservering verlopen")) {
    return {
      paragraphs: [
        "Een reservering (bijvoorbeeld voor ophalen of een externe betaling) is verlopen omdat de afspraak niet binnen de termijn is afgerond. Het item staat weer beschikbaar voor verkoop.",
        "Er is geen geld verplaatst — bij externe ophaal-reserveringen loopt de betaling immers buiten het platform om. Willen jullie alsnog doorgaan, dan kan de koper het item opnieuw reserveren.",
      ],
      linkLabel,
    };
  }

  /* --- Bestelling afgerond ---------------------------------------- */
  if (n.type === "ORDER_COMPLETED" || n.type === "ORDER_AUTO_CONFIRMED" || title.includes("afgerond")) {
    return {
      paragraphs: [
        title.includes("automatisch")
          ? "Deze bestelling is automatisch afgerond omdat er 30 dagen na verzending geen bevestiging of probleemmelding is binnengekomen. Dit is de standaard vangnet-regel die verkopers beschermt tegen kopers die vergeten te bevestigen."
          : "Deze bestelling is afgerond: de levering is bevestigd.",
        "Het bedrag dat in bewaring stond is vrijgegeven aan de verkoper (minus de commissie over de itemprijs). Beide partijen kunnen nu een review achterlaten — reviews leveren XP op en bouwen je reputatie op.",
      ],
      linkLabel,
    };
  }

  /* --- Berichten --------------------------------------------------- */
  if (n.type === "NEW_MESSAGE") {
    if (title.includes("bundel-voorstel") || title.includes("voorstel")) {
      return {
        paragraphs: [
          "Er is activiteit rond een voorstel: een prijsvoorstel of bundel-aanbod is gedaan, beantwoord of verlopen. De details staan in de melding hierboven en in het bijbehorende gesprek.",
          "Voorstellen verlopen automatisch na 3 dagen zonder reactie. Een geaccepteerd voorstel wordt direct afgerekend als het saldo toereikend is; anders geldt een betaaltermijn van 5 dagen.",
        ],
        linkLabel,
      };
    }
    if (title.includes("ophaal")) {
      return {
        paragraphs: [
          "Er staat een ophaalafspraak gepland of er is iets gewijzigd rond het ophaalmoment. Controleer datum, tijd en locatie in het gesprek.",
          "Bij ophalen met platform-betaling bevestigt de koper met de ophaalcode; het geld wordt daarna vrijgegeven aan de verkoper. Bij externe betaling regelen jullie de betaling onderling bij het ophalen.",
        ],
        linkLabel,
      };
    }
    return {
      paragraphs: [
        "Je hebt een nieuw chatbericht ontvangen. Open het gesprek om te reageren.",
        "Tip: houd de communicatie altijd binnen Cards Center — zo staat alles vast als er ooit een meningsverschil ontstaat en blijft koperbescherming van kracht.",
      ],
      linkLabel,
    };
  }

  /* --- Collectie inkoop (buyback) ---------------------------------- */
  if (n.type.startsWith("BUYBACK_")) {
    const stage =
      n.type === "BUYBACK_SUBMITTED"
        ? "Je inkoopaanvraag is ontvangen en staat in de wachtrij voor beoordeling."
        : n.type === "BUYBACK_RECEIVED"
          ? "Je ingezonden kaarten zijn bij ons aangekomen en worden klaargezet voor inspectie."
          : n.type === "BUYBACK_INSPECTING"
            ? "Je kaarten worden op dit moment stuk voor stuk geïnspecteerd op echtheid en conditie."
            : n.type === "BUYBACK_APPROVED" || n.type === "BUYBACK_PARTIALLY_APPROVED"
              ? "De inspectie is afgerond en de aanvraag is (deels) goedgekeurd. Bij een gedeeltelijke goedkeuring staat per kaart toegelicht wat er afweek."
              : n.type === "BUYBACK_PRICE_CORRECTION"
                ? "Tijdens de inspectie bleek de conditie of marktwaarde van één of meer kaarten af te wijken van de opgave, waardoor het voorgestelde bedrag is aangepast."
                : n.type === "BUYBACK_PAID"
                  ? "Het inkoopbedrag is uitbetaald naar je saldo. Je kunt het vrij gebruiken of laten uitbetalen naar je bankrekening."
                  : n.type === "BUYBACK_REJECTED"
                    ? "De aanvraag is afgewezen — de reden staat in de melding hierboven. Je kaarten worden kosteloos naar je teruggestuurd."
                    : "De status van je inkoopaanvraag is bijgewerkt.";
    return {
      paragraphs: [
        stage,
        "Het volledige verloop (aanvraag → ontvangst → inspectie → uitslag → uitbetaling) kun je stap voor stap volgen op de inkoop-pagina.",
      ],
      linkLabel,
    };
  }

  /* --- Geschillen --------------------------------------------------- */
  if (n.type.startsWith("DISPUTE_")) {
    return {
      paragraphs: [
        "Er is een update in een geschil waar jij partij in bent. De details staan in de melding hierboven en op de geschil-pagina.",
        "Zolang een geschil loopt, blijft het aankoopbedrag veilig in bewaring — er wordt niets uitbetaald tot er een uitkomst is. Reageer op tijd: bij uitblijvende reactie kan het geschil automatisch in het voordeel van de andere partij worden beslist.",
      ],
      linkLabel,
    };
  }

  /* --- Verificatie --------------------------------------------------- */
  if (n.type === "VERIFICATION_APPROVED") {
    return {
      paragraphs: [
        "Je verificatie is goedgekeurd! Het bijbehorende vertrouwens-label staat nu op je profiel, zichtbaar voor iedereen die met je handelt.",
        "Met een geverifieerd ID kun je bovendien bieden vanaf €2000. Hoe meer verificaties (ID, IBAN, adres), hoe meer vertrouwen kopers en verkopers in je hebben.",
      ],
      linkLabel,
    };
  }
  if (n.type === "VERIFICATION_REJECTED") {
    return {
      paragraphs: [
        "Je verificatie-aanvraag is afgewezen — de reden staat in de melding hierboven. Meestal gaat het om een onleesbaar document, een verlopen document of gegevens die niet overeenkomen met je profiel.",
        "Je kunt direct een nieuwe aanvraag indienen met een verbeterd document via de verificatie-pagina.",
      ],
      linkLabel,
    };
  }

  /* --- Volglijst ------------------------------------------------------ */
  if (n.type === "WATCHLIST_ENDING") {
    return {
      paragraphs: [
        "Een veiling op je volglijst loopt bijna af. Wil je nog meedingen, dan is dit het moment om een bod te plaatsen.",
        "Tip: biedingen in de laatste 2 minuten verlengen de veiling automatisch met 2 minuten (anti-snipe), zodat iedereen eerlijk kan reageren.",
      ],
      linkLabel,
    };
  }

  /* --- Evenementen ---------------------------------------------------- */
  if (n.type.startsWith("EVENT_") || n.type === "TRUSTED_ORGANIZER") {
    return {
      paragraphs: [
        "Er is een update rond een evenement: een goedkeuring, afwijzing, standhouder-aanvraag of organisator-status. De details staan in de melding hierboven.",
        "Beheer je evenementen en standhouder-aanvragen via het evenementen-overzicht in je dashboard.",
      ],
      linkLabel,
    };
  }

  /* --- Account ---------------------------------------------------------- */
  if (n.type === "ACCOUNT_UPDATE") {
    return {
      paragraphs: [
        "Dit is een service-melding over je account — bijvoorbeeld een beveiligingswijziging, een admin-actie of een statuswijziging. De details staan in de melding hierboven.",
        "Herken je deze wijziging niet? Wijzig dan direct je wachtwoord op je profiel en neem contact op via de support-pagina.",
      ],
      linkLabel,
    };
  }

  /* --- Fallback ----------------------------------------------------------- */
  return {
    paragraphs: [
      "De details van deze melding staan hierboven. Gebruik de knop hieronder om naar de bijbehorende pagina te gaan voor meer context.",
    ],
    linkLabel,
  };
}
