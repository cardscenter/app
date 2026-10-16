import { PLATFORM, hasKvk, hasVat } from "@/lib/platform-config";

// Wettelijk verplichte identiteitsgegevens van de ondernemer (naam, rechtsvorm,
// vestigingsadres, e-mail, KvK, btw-id — rechtsvorm bewust niet). Plain NL, conform de voorwaarden-,
// privacy- en support-pagina's die 'm gebruiken. KvK/btw verschijnen pas zodat
// ze in platform-config.ts zijn ingevuld. Design-pass: licht blok in de leeskolom.
export function CompanyIdentity({ heading }: { heading: string }) {
  const a = PLATFORM.address;
  return (
    <div className="mt-8 rounded-[12px] bg-[var(--background)] p-5 text-sm text-[var(--foreground)]/75">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground)]/50">{heading}</p>
      <address className="mt-2 not-italic text-base leading-relaxed">
        <span className="font-semibold text-[var(--foreground)]">{PLATFORM.legalName}</span>
        <br />
        {a.street} {a.houseNumber}, {a.postalCode} {a.city}, {a.country}
        <br />
        E-mail:{" "}
        <a href={`mailto:${PLATFORM.supportEmail}`} className="font-semibold text-[var(--primary)] hover:underline">
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
