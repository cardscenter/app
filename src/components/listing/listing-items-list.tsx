import { getTranslations } from "next-intl/server";
import { Check, ShoppingBasket, Clock } from "lucide-react";

interface Item {
  id: string;
  cardName: string;
  condition: string | null;
  quantity: number;
  status: string;
}

interface Props {
  items: Item[];
}

// Toont per-item status binnen een MULTI_CARD listing. Leesbaar voor zowel
// publieke kopers als de eigenaar; verkochte items worden duidelijk gemarkeerd
// zodat er geen verwarring ontstaat over wat er nog beschikbaar is.
export async function ListingItemsList({ items }: Props) {
  const t = await getTranslations("listing");
  if (items.length === 0) return null;

  const available = items.filter((i) => i.status === "AVAILABLE").length;
  const reserved = items.filter((i) => i.status === "RESERVED").length;
  const sold = items.filter((i) => i.status === "SOLD").length;

  return (
    <div className="glass-subtle rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          {t("itemsList.title")} ({items.length})
        </h2>
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Check className="h-3 w-3" />
            {available}
          </span>
          {reserved > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <Clock className="h-3 w-3" />
              {reserved}
            </span>
          )}
          {sold > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 font-medium text-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
              <ShoppingBasket className="h-3 w-3" />
              {sold}
            </span>
          )}
        </div>
      </div>

      <ul className="divide-y divide-border">
        {items.map((it) => {
          const isSold = it.status === "SOLD";
          const isReserved = it.status === "RESERVED";
          return (
            <li key={it.id} className="flex items-center gap-2 py-2 text-sm">
              <span
                className={`flex-1 ${isSold ? "text-muted-foreground line-through" : "text-foreground"}`}
              >
                {it.quantity > 1 ? `${it.quantity}× ` : ""}{it.cardName}
                {it.condition && (
                  <span className="ml-1 text-xs text-muted-foreground">· {it.condition}</span>
                )}
              </span>
              {isSold && (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
                  {t("itemsList.statusSold")}
                </span>
              )}
              {isReserved && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  {t("itemsList.statusReserved")}
                </span>
              )}
              {!isSold && !isReserved && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {t("itemsList.statusAvailable")}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
