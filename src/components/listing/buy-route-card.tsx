import type { ReactNode } from "react";
import { Truck, MapPin, Wallet, HandCoins, ExternalLink } from "lucide-react";

type Variant = "ship" | "pickup_platform" | "pickup_external";

interface Props {
  variant: Variant;
  title: string;
  subtitle: string;
  /** Plaatsnaam voor pickup-routes — toont "Op kaart" link naar Google Maps. */
  pickupCity?: string | null;
  children: ReactNode;
}

// Wrapper rond elke koop-route op listing-detail page (Fase 27.46). Geeft elk
// blok een prominente header met icon + tone-kleur zodat koper in één oogopslag
// ziet welke route hij kiest. Voorkomt verwarring bij listings met meerdere
// pickup-modes onder elkaar (vooraf-via-wallet vs bij-ophalen-Tikkie).
//
// Fase 27.91: pickup-routes tonen de plaatsnaam in de title én een externe
// link naar Google Maps zodat koper meteen kan checken of de afstand werkbaar is.
export function BuyRouteCard({ variant, title, subtitle, pickupCity, children }: Props) {
  const styles = {
    ship: {
      border: "border-emerald-200 dark:border-emerald-900",
      headerBg: "bg-emerald-50 dark:bg-emerald-950/30",
      headerText: "text-emerald-900 dark:text-emerald-200",
      icon: <Truck className="h-6 w-6" />,
    },
    pickup_platform: {
      border: "border-blue-200 dark:border-blue-900",
      headerBg: "bg-blue-50 dark:bg-blue-950/30",
      headerText: "text-blue-900 dark:text-blue-200",
      icon: (
        <span className="flex flex-col items-center gap-0.5">
          <MapPin className="h-5 w-5" />
          <Wallet className="h-5 w-5" />
        </span>
      ),
    },
    pickup_external: {
      border: "border-amber-200 dark:border-amber-900",
      headerBg: "bg-amber-50 dark:bg-amber-950/30",
      headerText: "text-amber-900 dark:text-amber-200",
      icon: (
        <span className="flex flex-col items-center gap-0.5">
          <MapPin className="h-5 w-5" />
          <HandCoins className="h-5 w-5" />
        </span>
      ),
    },
  }[variant];

  // Maps-link alleen voor pickup-routes met een bekende stad. Opent Google
  // Maps in nieuwe tab met de stad als zoekopdracht. Op mobile springt dit
  // automatisch naar de Maps-app waar geïnstalleerd.
  const showMapsLink = pickupCity && (variant === "pickup_platform" || variant === "pickup_external");
  const mapsUrl = pickupCity ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pickupCity)}` : null;

  return (
    <div className={`overflow-hidden rounded-xl border ${styles.border}`}>
      <div className={`flex items-center gap-3 px-3 py-3 text-sm font-semibold ${styles.headerBg} ${styles.headerText}`}>
        <span className="flex-shrink-0">{styles.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="truncate">{title}</div>
          <div className="text-xs font-normal opacity-80">{subtitle}</div>
        </div>
        {showMapsLink && mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex shrink-0 items-center gap-1 rounded-md border border-current/20 px-2 py-1 text-[11px] font-medium transition-colors hover:bg-white/40 dark:hover:bg-white/10 ${styles.headerText}`}
            title={`Bekijk ${pickupCity} op kaart`}
          >
            <ExternalLink className="h-3 w-3" />
            Op kaart
          </a>
        )}
      </div>
      <div className="bg-card p-3">{children}</div>
    </div>
  );
}
