import { getTranslations } from "next-intl/server";
import { Check, ShoppingBasket, Clock } from "lucide-react";

interface Item {
  id: string;
  cardName: string;
  condition: string | null;
  quantity: number;
  status: string;
  tcgdexId?: string | null;
  cardSetId?: string | null;
}

interface Props {
  items: Item[];
}

interface ItemGroup {
  key: string;
  cardName: string;
  condition: string | null;
  available: number;
  reserved: number;
  sold: number;
}

function buildGroups(items: Item[]): ItemGroup[] {
  const map = new Map<string, ItemGroup>();
  for (const it of items) {
    const key = `${it.cardName}|${it.condition ?? ""}|${it.tcgdexId ?? ""}|${it.cardSetId ?? ""}`;
    let g = map.get(key);
    if (!g) {
      g = { key, cardName: it.cardName, condition: it.condition, available: 0, reserved: 0, sold: 0 };
      map.set(key, g);
    }
    if (it.status === "AVAILABLE") g.available++;
    else if (it.status === "RESERVED") g.reserved++;
    else if (it.status === "SOLD") g.sold++;
  }
  return Array.from(map.values());
}

// Toont per kaart-groep de status binnen een MULTI_CARD listing. Items met
// gelijke (naam, conditie, tcgdex-id) worden samengevouwen tot één rij met
// counts: "Pikachu — 3 beschikbaar · 1 gereserveerd · 1 verkocht". Voorkomt
// dat een listing met "5x Pikachu" vijf identieke regels toont.
export async function ListingItemsList({ items }: Props) {
  const t = await getTranslations("listing");
  if (items.length === 0) return null;

  const groups = buildGroups(items);
  const totalAvailable = items.filter((i) => i.status === "AVAILABLE").length;
  const totalReserved = items.filter((i) => i.status === "RESERVED").length;
  const totalSold = items.filter((i) => i.status === "SOLD").length;

  return (
    <div className="glass-subtle rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          {t("itemsList.title")} ({items.length})
        </h2>
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Check className="h-3 w-3" />
            {totalAvailable}
          </span>
          {totalReserved > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <Clock className="h-3 w-3" />
              {totalReserved}
            </span>
          )}
          {totalSold > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 font-medium text-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
              <ShoppingBasket className="h-3 w-3" />
              {totalSold}
            </span>
          )}
        </div>
      </div>

      <ul className="divide-y divide-border">
        {groups.map((g) => {
          const total = g.available + g.reserved + g.sold;
          const allSold = g.available === 0 && g.reserved === 0;
          return (
            <li key={g.key} className="flex items-center gap-2 py-2 text-sm">
              <span
                className={`flex-1 ${allSold ? "text-muted-foreground line-through" : "text-foreground"}`}
              >
                {total > 1 ? `${total}× ` : ""}{g.cardName}
                {g.condition && (
                  <span className="ml-1 text-xs text-muted-foreground">· {g.condition}</span>
                )}
              </span>
              <div className="flex items-center gap-1.5 text-xs">
                {g.available > 0 && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {g.available} {t("itemsList.statusAvailable").toLowerCase()}
                  </span>
                )}
                {g.reserved > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    {g.reserved} {t("itemsList.statusReserved").toLowerCase()}
                  </span>
                )}
                {g.sold > 0 && (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 font-medium text-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
                    {g.sold} {t("itemsList.statusSold").toLowerCase()}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
