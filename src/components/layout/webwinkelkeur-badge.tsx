import { Star, ExternalLink } from "lucide-react";
import type { WebwinkelkeurSummary } from "@/lib/webwinkelkeur";

const WEBWINKELKEUR_SHOP_URL = "https://www.webwinkelkeur.nl/webshop/Cards-Center_1215156";

interface WebwinkelkeurBadgeProps {
  summary: WebwinkelkeurSummary;
}

/**
 * Klikbare rating-pill in de top-bar. Open de officiële Webwinkelkeur
 * shop-pagina in een nieuw tabblad — daar staan alle reviews + keurmerk-info.
 *
 * Server component — geen client-state nodig (modal is weg).
 */
export function WebwinkelkeurBadge({ summary }: WebwinkelkeurBadgeProps) {
  const isTenScale = summary.ratingAverage > 5;
  const starsOutOfFive = isTenScale ? summary.ratingAverage / 2 : summary.ratingAverage;
  const filledStars = Math.round(starsOutOfFive);
  const displayValue = summary.ratingAverage.toFixed(1);
  const displayMax = isTenScale ? "10" : "5";

  return (
    <a
      href={WEBWINKELKEUR_SHOP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-2 transition-colors hover:text-foreground"
      aria-label={`Bekijk reviews op Webwinkelkeur — ${displayValue} van ${displayMax}, ${summary.amount} reviews`}
    >
      <span className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={
              i <= filledStars
                ? "size-3 fill-emerald-500 text-emerald-500"
                : "size-3 fill-none text-muted-foreground/30"
            }
          />
        ))}
      </span>
      <span className="text-xs">
        <span className="font-semibold text-foreground">{displayValue}</span>
        <span className="text-muted-foreground"> / {displayMax}</span>
        <span className="ml-1 hidden text-muted-foreground md:inline">
          ({summary.amount.toLocaleString("nl-NL")} reviews)
        </span>
      </span>
      <ExternalLink className="size-3 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100" />
    </a>
  );
}
