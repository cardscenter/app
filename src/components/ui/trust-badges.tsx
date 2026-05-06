import { ShieldCheck, Landmark, MapPin } from "lucide-react";

/**
 * Trust-badges (Fase 32) — toont alleen de verificaties die DAADWERKELIJK
 * geverifieerd zijn. Niet-geverifieerde types worden niet getoond.
 *
 * Drie types:
 *  - ID         (paspoort/ID/rijbewijs, gate voor bids ≥ €2000)
 *  - IBAN       (rekeningnummer match via bankstorting)
 *  - Adres      (officieel document met naam + adres)
 */
interface Props {
  isVerified?: boolean;
  isIbanVerified?: boolean;
  isAddressVerified?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function TrustBadges({
  isVerified,
  isIbanVerified,
  isAddressVerified,
  size = "sm",
  className = "",
}: Props) {
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const padding = size === "sm" ? "px-1.5 py-0.5" : "px-2 py-1";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  if (!isVerified && !isIbanVerified && !isAddressVerified) {
    return null;
  }

  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      {isVerified && (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-sky-100 ${padding} ${textSize} font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300`}
          title="Identiteit geverifieerd"
        >
          <ShieldCheck className={iconSize} />
          ID
        </span>
      )}
      {isIbanVerified && (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-emerald-100 ${padding} ${textSize} font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300`}
          title="Rekeningnummer geverifieerd"
        >
          <Landmark className={iconSize} />
          IBAN
        </span>
      )}
      {isAddressVerified && (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-violet-100 ${padding} ${textSize} font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300`}
          title="Adres geverifieerd"
        >
          <MapPin className={iconSize} />
          Adres
        </span>
      )}
    </span>
  );
}
