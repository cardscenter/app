import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Tag } from "lucide-react";
import Image from "next/image";

export interface ClaimsaleCardData {
  id: string;
  title: string;
  coverImage: string | null;
  shippingCost: number;
  seller: { displayName: string };
  _count: { items: number };
  items: { id: string; price: number }[];
}

export function ClaimsaleCard({ claimsale }: { claimsale: ClaimsaleCardData }) {
  const t = useTranslations("claimsale");

  const availableCount = claimsale.items.length;
  const prices = claimsale.items.map((i) => i.price);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

  return (
    <Link
      href={`/claimsales/${claimsale.id}`}
      className="group glass overflow-hidden rounded-2xl transition-all hover:shadow-lg hover:scale-[1.01] flex flex-row sm:flex-col"
    >
      {/* Card image — mobile: fixed size, desktop: aspect-square with fill */}
      <div className="shrink-0 sm:relative sm:w-full sm:aspect-square bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
        {claimsale.coverImage ? (
          <>
            {/* Mobile: fixed width/height */}
            <Image
              src={claimsale.coverImage}
              alt={claimsale.title}
              width={96}
              height={128}
              className="sm:hidden object-cover w-24 h-32"
              sizes="96px"
            />
            {/* Desktop: fill */}
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
        {/* Badges — desktop only */}
        <div className="hidden sm:block absolute top-3 left-3">
          <span className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-white">
            {availableCount}/{claimsale._count.items}{" "}
            {t("available").toLowerCase()}
          </span>
        </div>
        <div className="hidden sm:block absolute top-3 right-3">
          <span className="rounded-md bg-black/70 px-2 py-1 text-xs text-white backdrop-blur-sm">
            &euro;{claimsale.shippingCost.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between">
        <div>
          <h3 className="font-semibold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors line-clamp-2">
            {claimsale.title}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {claimsale.seller.displayName}
          </p>
          {/* Mobile-only badges */}
          <div className="mt-1.5 flex items-center gap-2 sm:hidden">
            <span className="rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-medium text-white">
              {availableCount}/{claimsale._count.items} {t("available").toLowerCase()}
            </span>
            <span className="text-[10px] text-muted-foreground">
              + &euro;{claimsale.shippingCost.toFixed(2)} verzendkosten
            </span>
          </div>
        </div>

        {/* Price range */}
        {prices.length > 0 && (
          <div className="mt-2 sm:mt-4">
            <p className="text-lg sm:text-xl font-bold text-foreground">
              {minPrice === maxPrice
                ? `\u20AC${minPrice.toFixed(2)}`
                : `\u20AC${minPrice.toFixed(2)} \u2014 \u20AC${maxPrice.toFixed(2)}`}
            </p>
          </div>
        )}
      </div>
    </Link>
  );
}
