import { PLATFORM, hasKvk, hasVat } from "@/lib/platform-config";

// Wettelijk verplichte identiteitsgegevens van de ondernemer (naam, rechtsvorm,
// vestigingsadres, e-mail, KvK, btw-id — rechtsvorm bewust niet). Plain NL, conform de voorwaarden-,
// privacy- en support-pagina's die 'm gebruiken. KvK/btw verschijnen pas zodra
// ze in platform-config.ts zijn ingevuld.
export function CompanyIdentity({ heading }: { heading: string }) {
  const a = PLATFORM.address;
  return (
    <div className="mt-6 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
      <p className="font-semibold text-foreground">{heading}</p>
      <address className="mt-1 not-italic leading-relaxed">
        {PLATFORM.legalName}
        <br />
        {a.street} {a.houseNumber}, {a.postalCode} {a.city}, {a.country}
        <br />
        E-mail:{" "}
        <a href={`mailto:${PLATFORM.supportEmail}`} className="font-medium text-primary hover:underline">
          {PLATFORM.supportEmail}
        </a>
        {hasKvk() && (
          <>
            <br />
            KvK-nummer: {PLATFORM.kvkNumber}
          </>
        )}
        {hasVat() && (
          <>
            <br />
            Btw-identificatienummer: {PLATFORM.vatId}
          </>
        )}
      </address>
    </div>
  );
}
