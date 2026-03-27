import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Tag } from "lucide-react";

export interface ClaimsaleCardData {
  id: string;
  title: string;
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
      className="group glass overflow-hidden rounded-2xl transition-all hover:shadow-lg hover:scale-[1.01]"
    >
      {/* Card image placeholder */}
      <div className="relative h-36 bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
        <Tag className="h-10 w-10 text-slate-300 dark:text-slate-600" />
        {/* Available count badge */}
        <div className="absolute top-3 left-3">
          <span className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-white">
            {availableCount}/{claimsale._count.items}{" "}
            {t("available").toLowerCase()}
          </span>
        </div>
        {/* Shipping badge */}
        <div className="absolute top-3 right-3">
          <span className="rounded-md bg-black/70 px-2 py-1 text-xs text-white backdrop-blur-sm">
            &euro;{claimsale.shippingCost.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="p-4">
        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
          {claimsale.title}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {claimsale.seller.displayName}
        </p>

        {/* Price range */}
        {prices.length > 0 && (
          <div className="mt-4">
            <p className="text-xl font-bold text-foreground">
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
