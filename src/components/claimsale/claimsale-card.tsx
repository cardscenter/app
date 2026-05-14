import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Tag, Clock } from "lucide-react";
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

  return (
    <Link
      href={`/claimsales/${claimsale.id}`}
      className={`group glass overflow-hidden rounded-2xl transition-all hover:shadow-lg hover:scale-[1.01] flex flex-row sm:flex-col ${
        sponsored ? "ring-1 ring-amber-400/60" : ""
      }`}
    >
      <div className="shrink-0 sm:relative sm:w-full sm:aspect-square bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
        {claimsale.coverImage ? (
          <>
            <Image
              src={claimsale.coverImage}
              alt={claimsale.title}
              width={96}
              height={128}
              className="sm:hidden object-cover w-24 h-32"
              sizes="96px"
            />
            <Image
              src={claimsale.coverImage}
              alt={claimsale.title}
              fill
              className="hidden sm:block object-cover"
              sizes="(max-width: 640px) 0px, (max-width: 1024px) 50vw, 25vw"
            />
          </>
        ) : (
          <Tag className="h-10 w-10 text-slate-300 dark:text-slate-600" />
        )}
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

      <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between">
        <div>
          <h3 className="font-semibold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors line-clamp-2">
            {claimsale.title}
          </h3>
          {claimsale.labels && claimsale.labels.length > 0 && (
            <ClaimsaleLabels labels={claimsale.labels} className="mt-1.5" />
          )}
          <p className="mt-1 text-xs text-muted-foreground">{claimsale.seller.displayName}</p>
          <SellerLocationLine seller={claimsale.seller} buyer={buyer} />
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

        {prices.length > 0 && (
          <div className="mt-2 sm:mt-4">
            <p className="text-lg sm:text-xl font-bold text-foreground">
              {minPrice === maxPrice
                ? `€${minPrice.toFixed(2)}`
                : `€${minPrice.toFixed(2)} — €${maxPrice.toFixed(2)}`}
            </p>
          </div>
        )}
      </div>
    </Link>
  );
}
