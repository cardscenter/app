import {
  Truck,
  Package,
  Search,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Banknote,
  Ban,
  Clock,
} from "lucide-react";
import type { BuybackRequest, BuybackItem, BulkBuybackItem } from "@prisma/client";
import { PLATFORM } from "@/lib/platform-config";
import { RETURN_FEE_EUR, DECISION_DAYS } from "@/lib/buyback-status";

type RequestWithItems = BuybackRequest & {
  items: BuybackItem[];
  bulkItems: BulkBuybackItem[];
};


/**
 * Status- en uitkomst-bewuste uitleg voor de verkoper. Beantwoordt voor elke
 * fase: wat gebeurt er nu, wat moet ik doen, wat zijn de financiële gevolgen
 * (incl. retourkosten bij gedeeltelijke afkeur of afgewezen prijscorrectie).
 */
export function BuybackOutcomeInfo({ request }: { request: RequestWithItems }) {
  switch (request.status) {
    case "PENDING":
      return <PendingInfo />;
    case "RECEIVED":
      return <ReceivedInfo />;
    case "INSPECTING":
      return <InspectingInfo request={request} />;
    case "APPROVED":
      return <ApprovedInfo />;
    case "PARTIALLY_APPROVED":
      return <PartiallyApprovedInfo request={request} />;
    case "REJECTED":
      return <RejectedInfo />;
    case "RETURN_REQUESTED":
      return <ReturnRequestedInfo />;
    case "RETURNED":
      return <ReturnedInfo request={request} />;
    case "PAID":
      return <PaidInfo />;
    case "CANCELLED":
      return <CancelledInfo />;
    default:
      return null;
  }
}

interface InfoCardProps {
  variant: "sky" | "amber" | "emerald" | "red" | "slate" | "purple";
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function InfoCard({ variant, icon, title, children }: InfoCardProps) {
  const styles = {
    sky:     { bg: "bg-sky-50/70 dark:bg-sky-950/30",         border: "border-sky-400 dark:border-sky-500",     text: "text-sky-900 dark:text-sky-100",         body: "text-sky-800/80 dark:text-sky-200/80",         iconColor: "text-sky-600 dark:text-sky-400" },
    amber:   { bg: "bg-amber-50/70 dark:bg-amber-950/30",     border: "border-amber-400 dark:border-amber-500", text: "text-amber-900 dark:text-amber-100",     body: "text-amber-800/80 dark:text-amber-200/80",     iconColor: "text-amber-600 dark:text-amber-400" },
    emerald: { bg: "bg-emerald-50/70 dark:bg-emerald-950/30", border: "border-emerald-400 dark:border-emerald-500", text: "text-emerald-900 dark:text-emerald-100", body: "text-emerald-800/80 dark:text-emerald-200/80", iconColor: "text-emerald-600 dark:text-emerald-400" },
    red:     { bg: "bg-red-50/70 dark:bg-red-950/30",         border: "border-red-400 dark:border-red-500",     text: "text-red-900 dark:text-red-100",         body: "text-red-800/80 dark:text-red-200/80",         iconColor: "text-red-600 dark:text-red-400" },
    slate:   { bg: "bg-slate-50 dark:bg-slate-900/40",        border: "border-slate-400 dark:border-slate-600", text: "text-slate-900 dark:text-slate-100",     body: "text-slate-700 dark:text-slate-300",           iconColor: "text-slate-600 dark:text-slate-400" },
    purple:  { bg: "bg-purple-50/70 dark:bg-purple-950/30",   border: "border-purple-400 dark:border-purple-500", text: "text-purple-900 dark:text-purple-100",   body: "text-purple-800/80 dark:text-purple-200/80",   iconColor: "text-purple-600 dark:text-purple-400" },
  }[variant];

  return (
    <section className={`rounded-xl border-l-4 ${styles.border} ${styles.bg} p-4`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${styles.iconColor}`}>{icon}</div>
        <div className="min-w-0 flex-1">
          <h3 className={`text-sm font-bold ${styles.text}`}>{title}</h3>
          <div className={`mt-1.5 space-y-2 text-sm ${styles.body}`}>{children}</div>
        </div>
      </div>
    </section>
  );
}

// ── Status-specific cards ────────────────────────────────────────────────────

function PendingInfo() {
  return (
    <InfoCard variant="amber" icon={<Truck className="h-5 w-5" />} title="Verzend je pakket binnen 5 dagen">
      <p>
        Je aanvraag staat klaar. Verzend je pakket aangetekend en verzekerd binnen 5 dagen na het indienen, en vul
        de Track &amp; Trace-code in zodat we je zending kunnen volgen.
      </p>
      <p>
        <strong>Belangrijk:</strong> vermeld een afzendadres op de doos én een briefje met je naam in het pakket. Zonder
        afzender kunnen we de zending niet aan je aanvraag koppelen en kunnen we geen uitbetaling verrichten.
      </p>
    </InfoCard>
  );
}

function ReceivedInfo() {
  return (
    <InfoCard variant="sky" icon={<Package className="h-5 w-5" />} title="Pakket ontvangen — bedankt!">
      <p>
        We hebben je zending in goede orde ontvangen. De inspectie en verwerking kan tot{" "}
        <strong>3 werkdagen</strong> duren. Je krijgt automatisch een melding zodra we starten met de inspectie en
        wanneer de definitieve uitbetaling is bepaald.
      </p>
    </InfoCard>
  );
}

function InspectingInfo({ request }: { request: RequestWithItems }) {
  const pendingCorrections = request.items.filter(
    (i) => i.priceCorrected && i.userApprovedCorrection === null,
  );
  if (pendingCorrections.length > 0) {
    return (
      <InfoCard
        variant="amber"
        icon={<AlertCircle className="h-5 w-5" />}
        title={`${pendingCorrections.length} prijscorrectie${pendingCorrections.length === 1 ? "" : "s"} wachten op je akkoord`}
      >
        <p>
          We hebben bij de inspectie een prijsfout opgemerkt op {pendingCorrections.length === 1 ? "een kaart" : "enkele kaarten"}.
          Bekijk hieronder per kaart de voorgestelde correctie en accepteer of wijs af. <strong>De inkoop kan pas worden
          afgerond als je op alle correcties hebt gereageerd.</strong>
        </p>
        <p>
          Als je een correctie afwijst, wordt de betreffende kaart niet ingekocht. Na de controle kies je of je de
          afgekeurde kaarten retour wilt (<strong>€{RETURN_FEE_EUR.toFixed(2)}</strong>, vooraf te betalen) of ze bij ons laat.
        </p>
      </InfoCard>
    );
  }
  return (
    <InfoCard variant="purple" icon={<Search className="h-5 w-5" />} title="We controleren je kaarten">
      <p>
        Onze admins inspecteren je zending nu op conditie en prijsjuistheid. Zodra de inspectie klaar is hoor je het
        resultaat per e-mail en kun je het hier in het dashboard zien.
      </p>
    </InfoCard>
  );
}

function ApprovedInfo() {
  return (
    <InfoCard variant="emerald" icon={<CheckCircle2 className="h-5 w-5" />} title="Alle kaarten goedgekeurd">
      <p>
        Goed nieuws: alles klopt met je opgave. De uitbetaling wordt nu verwerkt; je ontvangt een melding zodra het
        bedrag is overgemaakt naar je bankrekening.
      </p>
    </InfoCard>
  );
}

function PartiallyApprovedInfo({ request }: { request: RequestWithItems }) {
  const approved = request.items.filter((i) => i.inspectionStatus === "APPROVED").length;
  const rejected = request.items.filter((i) => i.inspectionStatus === "REJECTED").length;
  const correctionsAccepted = request.items.filter((i) => i.priceCorrected && i.userApprovedCorrection === true).length;
  const correctionsRejected = request.items.filter((i) => i.priceCorrected && i.userApprovedCorrection === false).length;

  return (
    <InfoCard
      variant="amber"
      icon={<AlertCircle className="h-5 w-5" />}
      title="Gedeeltelijk goedgekeurd"
    >
      <p>
        Een deel van je zending is goedgekeurd, een deel niet. Hieronder zie je per kaart de status en eventuele reden
        van afkeur of een geaccepteerde prijscorrectie.
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>{approved}</strong> kaart{approved === 1 ? "" : "en"} goedgekeurd voor uitbetaling
          {correctionsAccepted > 0 && ` (waarvan ${correctionsAccepted} met geaccepteerde prijscorrectie)`}
        </li>
        <li>
          <strong>{rejected}</strong> kaart{rejected === 1 ? "" : "en"} afgekeurd
          {correctionsRejected > 0 &&
            ` (waarvan ${correctionsRejected} doordat je de voorgestelde prijscorrectie hebt afgewezen)`}
        </li>
      </ul>
      <p>
        <strong>Jij kiest:</strong> ga akkoord met de nieuwe berekening (dan betalen we dat bedrag uit en blijven de
        afgekeurde kaarten bij ons), of vraag de afgekeurde kaarten retour voor <strong>€{RETURN_FEE_EUR.toFixed(2)}</strong>
        (verzekerd, vooraf te betalen). Na je keuze of na {DECISION_DAYS} dagen betalen we het aangepaste bedrag uit.
      </p>
    </InfoCard>
  );
}

function RejectedInfo() {
  return (
    <InfoCard variant="red" icon={<XCircle className="h-5 w-5" />} title="Alle kaarten afgekeurd">
      <p>
        Helaas zijn alle ingestuurde kaarten afgekeurd. Bekijk de specifieke reden per kaart hieronder.
      </p>
      <p>
        Wil je de kaarten terug? Vraag dan hieronder een retour aan; dat kost <strong>€{RETURN_FEE_EUR.toFixed(2)}</strong>
        (verzekerde verzending), vooraf te betalen. Zonder retouraanvraag binnen {DECISION_DAYS} dagen blijven de kaarten
        bij Cards Center.
      </p>
      <p>
        Heb je vragen? Mail ons via{" "}
        <a className="underline underline-offset-2" href={`mailto:${PLATFORM.supportEmail}`}>
          {PLATFORM.supportEmail}
        </a>
        .
      </p>
    </InfoCard>
  );
}

function PaidInfo() {
  return (
    <InfoCard variant="emerald" icon={<Banknote className="h-5 w-5" />} title="Uitbetaling verwerkt">
      <p>
        De uitbetaling is overgemaakt naar je bankrekening. Het kan tot enkele werkdagen duren voordat het bedrag op
        je rekening staat.
      </p>
      <p>
        Bedankt voor je verkoop — we hopen je snel weer terug te zien!
      </p>
    </InfoCard>
  );
}

function ReturnRequestedInfo() {
  return (
    <InfoCard variant="purple" icon={<Truck className="h-5 w-5" />} title="Retourkosten ontvangen">
      <p>
        Bedankt, de retourkosten zijn binnen. We pakken je kaarten in en sturen ze binnen enkele werkdagen verzekerd
        terug. Zodra het pakket onderweg is zie je hier de Track &amp; Trace en krijg je een melding.
      </p>
    </InfoCard>
  );
}

function ReturnedInfo({ request }: { request: RequestWithItems }) {
  const payout = request.finalPayout ?? 0;
  return (
    <InfoCard variant="sky" icon={<Package className="h-5 w-5" />} title="Je kaarten zijn onderweg terug">
      <p>
        Het retourpakket is verzonden{request.returnCarrier ? ` met ${request.returnCarrier}` : ""}. De Track &amp; Trace
        staat hieronder.
      </p>
      {payout > 0 && (
        <p>
          Het goedgekeurde deel (<strong>€{payout.toFixed(2)}</strong>) wordt apart uitbetaald naar je bankrekening; je
          krijgt een melding zodra dat gebeurd is.
        </p>
      )}
    </InfoCard>
  );
}

function CancelledInfo() {
  return (
    <InfoCard variant="slate" icon={<Ban className="h-5 w-5" />} title="Aanvraag geannuleerd">
      <p>
        Deze aanvraag is geannuleerd en wordt niet verder verwerkt. Je kunt op elk moment een nieuwe aanvraag indienen
        via de verkoop calculator.
      </p>
    </InfoCard>
  );
}

// Generieke FAQ-blok onder de status-info — altijd beschikbaar.
// Type-aware: prijscorrectie-vragen verschijnen alleen voor COLLECTION omdat
// bulk-prijzen vast staan en geen correctie-flow doorlopen.
export function BuybackFAQ({ type }: { type?: string }) {
  const isCollection = type === "COLLECTION";

  const items: { q: string; a: string }[] = [
    ...(isCollection
      ? [
          {
            q: "Wat als een prijs in de calculator afwijkt van de werkelijke marktwaarde?",
            a: "Onze admins kunnen tijdens de inspectie een prijscorrectie voorstellen. Je krijgt dan op je dashboard de oude én voorgestelde prijs te zien, met opgave van reden, en kunt accepteren of afwijzen. De inkoop wordt pas afgerond als je op alle correcties hebt gereageerd.",
          },
          {
            q: "Wat gebeurt er als ik een prijscorrectie afwijs?",
            a: "Dan wordt de betreffende kaart niet ingekocht. Bij gedeeltelijke afkeur worden de niet-ingekochte kaarten samen geretourneerd in één pakket; bij volledige afkeur ontvang je het hele pakket terug.",
          },
        ]
      : []),
    {
      q: "Wat kost een retourzending?",
      a: `€${RETURN_FEE_EUR.toFixed(2)} per pakket, verzekerd verzonden. Je betaalt dit vooraf via iDEAL; daarna sturen we de kaarten terug en zie je de Track & Trace bij je aanvraag.`,
    },
    {
      q: "Hoe lang duurt het hele proces?",
      a: "Verzending door jou (binnen 5 dagen), controle door ons (binnen 3 werkdagen na ontvangst), uitbetaling per bank (enkele werkdagen overschrijftijd).",
    },
    {
      q: "Kan ik mijn aanvraag annuleren?",
      a: "Alleen voordat je het pakket hebt verzonden (status: Aangevraagd). Annuleren kan via de knop onderaan deze pagina. Zodra het pakket onderweg of binnen is, is de verkoop bindend.",
    },
    {
      q: "Wanneer is de verkoop bindend?",
      a: "Op het moment dat het pakket bij ons ontvangen is. Vanaf dan zijn de feitelijk ontvangen kaarten leidend voor de definitieve calculatie. De aantallen die je opgeeft zijn bindend: wijkt de telling af, dan krijg je een aangepaste berekening.",
    },
    {
      q: "Wat als de telling afwijkt van mijn opgave?",
      a: `Dan krijg je een aangepaste berekening. Je kiest zelf: akkoord (we betalen het nieuwe bedrag uit) of de afgekeurde kaarten retour voor €${RETURN_FEE_EUR.toFixed(2)}. Kies je niets binnen ${DECISION_DAYS} dagen, dan betalen we het aangepaste bedrag uit en blijven afgekeurde kaarten bij ons.`,
    },
  ];
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Clock className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-base font-bold text-foreground">Veelgestelde vragen</h2>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <details
            key={i}
            className="group rounded-lg border border-border/60 transition-colors open:border-primary/40"
          >
            <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/40">
              {item.q}
            </summary>
            <div className="border-t border-border/40 px-3 py-2 text-sm text-muted-foreground">
              {item.a}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
