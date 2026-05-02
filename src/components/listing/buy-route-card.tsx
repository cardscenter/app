import type { ReactNode } from "react";
import { Truck, MapPin, Wallet, HandCoins } from "lucide-react";

type Variant = "ship" | "pickup_platform" | "pickup_external";

interface Props {
  variant: Variant;
  title: string;
  subtitle: string;
  children: ReactNode;
}

// Wrapper rond elke koop-route op listing-detail page (Fase 27.46). Geeft elk
// blok een prominente header met icon + tone-kleur zodat koper in één oogopslag
// ziet welke route hij kiest. Voorkomt verwarring bij listings met meerdere
// pickup-modes onder elkaar (vooraf-via-wallet vs bij-ophalen-Tikkie).
export function BuyRouteCard({ variant, title, subtitle, children }: Props) {
  const styles = {
    ship: {
      border: "border-emerald-200 dark:border-emerald-900",
      headerBg: "bg-emerald-50 dark:bg-emerald-950/30",
      headerText: "text-emerald-900 dark:text-emerald-200",
      icon: <Truck className="h-4 w-4" />,
    },
    pickup_platform: {
      border: "border-blue-200 dark:border-blue-900",
      headerBg: "bg-blue-50 dark:bg-blue-950/30",
      headerText: "text-blue-900 dark:text-blue-200",
      icon: (
        <span className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          <Wallet className="h-3.5 w-3.5" />
        </span>
      ),
    },
    pickup_external: {
      border: "border-amber-200 dark:border-amber-900",
      headerBg: "bg-amber-50 dark:bg-amber-950/30",
      headerText: "text-amber-900 dark:text-amber-200",
      icon: (
        <span className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          <HandCoins className="h-3.5 w-3.5" />
        </span>
      ),
    },
  }[variant];

  return (
    <div className={`overflow-hidden rounded-xl border ${styles.border}`}>
      <div className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold ${styles.headerBg} ${styles.headerText}`}>
        {styles.icon}
        <div className="flex-1">
          <div>{title}</div>
          <div className="font-normal opacity-80">{subtitle}</div>
        </div>
      </div>
      <div className="bg-card p-3">{children}</div>
    </div>
  );
}
