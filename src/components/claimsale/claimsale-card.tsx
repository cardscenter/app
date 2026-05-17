import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import Image from "next/image";
import { SellerLocationLine } from "@/components/ui/seller-location-line";
import { ClaimsaleLabels, type ClaimsaleLabelData } from "./claimsale-labels";

export interface ClaimsaleCardData {
  id: string;
  title: string;
  coverImage: string | null;
  shippingCost: number;
  status?: string;
  startTime?: Date | null;
  labels?: ClaimsaleLabelData[];
  seller: {
    displayName: string;
    city?: string | null;
    postalCode?: string | null;
    country?: string | null;
  };
  _count: { items: number };
  items: { id: string; price: number }[];
}

interface ClaimsaleCardProps {
  claimsale: ClaimsaleCardData;
  buyer?: { country: string | null; postalCode: string | null } | null;
  sponsored?: boolean;
}

function formatStartPill(date: Date): string {
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function ClaimsaleCard({ claimsale, buyer, sponsored = false }: ClaimsaleCardProps) {
  const t = useTranslations("claimsale");

  const availableCount = claimsale.items.length;
  const prices = claimsale.items.map((i) => i.price);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const isScheduled = claimsale.status === "SCHEDULED";

  const hasCover = !!claimsale.coverImage;

  return (
    <Link
      href={`/claimsales/${claimsale.id}`}
      className={`group glass overflow-hidden rounded-2xl transition-all hover:shadow-lg hover:scale-[1.01] flex flex-row sm:flex-col ${
        sponsored ? "ring-1 ring-amber-400/60" : ""
      }`}
    >
      {/* Image-zone — alleen wanneer er een cover is. Geen placeholder-tile
          voor claimsales zonder thumbnail; layout reflowt naar pure content. */}
      {hasCover && (
        <div className="shrink-0 sm:relative sm:w-full sm:aspect-square bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
          <Image
            src={claimsale.coverImage!}
            alt={claimsale.title}
            width={96}
            height={128}
            className="sm:hidden object-cover w-24 h-32"
            sizes="96px"
          />
          <Image
            src={claimsale.coverImage!}
            alt={claimsale.title}
            fill
            className="hidden sm:block object-cover"
            sizes="(max-width: 640px) 0px, (max-width: 1024px) 50vw, 25vw"
          />
          <div className="hidden sm:block absolute top-3 left-3">
            {isScheduled && claimsale.startTime ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white shadow">
                <Clock className="h-3 w-3" />
                {t("scheduledStartPill", { date: formatStartPill(claimsale.startTime) })}
              </span>
            ) : (
              <span className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-white">
                {availableCount}/{claimsale._count.items} {t("available").toLowerCase()}
              </span>
            )}
          </div>
          {sponsored && (
            <div className="hidden sm:block absolute bottom-3 left-3">
              <span className="rounded-md bg-amber-500/95 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow">
                {t("sponsoredBadge")}
              </span>
            </div>
          )}
          <div className="hidden sm:block absolute top-3 right-3">
            <span className="rounded-md bg-black/70 px-2 py-1 text-xs text-white backdrop-blur-sm">
              &euro;{claimsale.shippingCost.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between">
        <div>
          {/* Desktop status-pill inline — alleen wanneer er geen image-zone is
              (anders zit de pill al boven de afbeelding). */}
          {!hasCover && (
            <div className="hidden sm:flex flex-wrap items-center gap-2 mb-2">
              {isScheduled && claimsale.startTime ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white">
                  <Clock className="h-3 w-3" />
                  {t("scheduledStartPill", { date: formatStartPill(claimsale.startTime) })}
                </span>
              ) : (
                <span className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-white">
                  {availableCount}/{claimsale._count.items} {t("available").toLowerCase()}
                </span>
              )}
              {sponsored && (
                <span className="rounded-md bg-amber-500/95 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                  {t("sponsoredBadge")}
                </span>
              )}
              <span className="rounded-md bg-muted px-2 py-1 text-xs text-foreground">
                &euro;{claimsale.shippingCost.toFixed(2)}
              </span>
            </div>
          )}

          <h3 className="font-semibold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors line-clamp-2">
            {claimsale.title}
          </h3>
          {claimsale.labels && claimsale.labels.length > 0 && (
            <ClaimsaleLabels labels={claimsale.labels} className="mt-1.5" />
          )}
          {/* Mobile status-pills blijven dicht onder de titel — op mobiel staan
              de cards niet in een grid van gelijke hoogte, dus visuele
              uitlijning is daar minder relevant. */}
          <div className="mt-1.5 flex items-center gap-2 sm:hidden">
            {isScheduled && claimsale.startTime ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
                <Clock className="h-2.5 w-2.5" />
                {t("scheduledStartPill", { date: formatStartPill(claimsale.startTime) })}
              </span>
            ) : (
              <span className="rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-medium text-white">
                {availableCount}/{claimsale._count.items} {t("available").toLowerCase()}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">
              + &euro;{claimsale.shippingCost.toFixed(2)} verzendkosten
            </span>
          </div>
        </div>

        {/* Onderste blok — seller + prijs samen in één container zodat
            justify-between (op de wrapper hierboven) ze samen tegen de bodem
            duwt. Op desktop hebben alle grid-cells dezelfde hoogte
            (grid-stretch), dus seller-info zit op alle cards op dezelfde
            y-positie ongeacht of er een cover-afbeelding boven zit. */}
        <div className="mt-2 sm:mt-4 flex flex-col gap-2">
          <div className="flex flex-col items-end gap-0.5">
            <p className="text-xs text-muted-foreground">{claimsale.seller.displayName}</p>
            <SellerLocationLine seller={claimsale.seller} buyer={buyer} className="!mt-0" />
          </div>

          {prices.length > 0 && (
            <p className="text-lg sm:text-xl font-bold text-foreground">
              {minPrice === maxPrice
                ? `€${minPrice.toFixed(2)}`
                : `€${minPrice.toFixed(2)} — €${maxPrice.toFixed(2)}`}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
