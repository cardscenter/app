"use client";

import { getMinimumIncrement, getMinimumNextBid } from "@/lib/auction/bid-increments";

/**
 * Drie chips onder de bid-input die de input vullen met een voorgesteld
 * biedbedrag. Was vroeger "Bied \u20ACX"-knoppen die misleidend waren (lijken
 * direct te biden); nu kleine chips met alleen het bedrag, secundair
 * gestyled.
 */
export function QuickBidButtons({
  currentBid,
  startingBid,
  onSelect,
}: {
  currentBid: number | null;
  startingBid: number;
  onSelect: (amount: number) => void;
}) {
  const base = currentBid ?? 0;
  const minimumBid = base === 0 ? startingBid : getMinimumNextBid(base);
  const increment = getMinimumIncrement(base === 0 ? startingBid : base);

  // Eerste chip = exact minimumBid (zodat je het minimum-bedrag direct kunt
  // bidden). Tweede en derde = ronde bedragen erboven, met een step die
  // past bij het increment-niveau zodat de chips natuurlijke "biedhoogtes"
  // tonen (€205 / €210 ipv €205,65 / €210,65).
  const niceStep = increment <= 1 ? 1 : increment <= 5 ? 5 : 10;
  const nextRound = Math.ceil((minimumBid + 0.01) / niceStep) * niceStep;

  const options = [
    minimumBid,
    nextRound,
    nextRound + niceStep,
  ];

  return (
    <div className="flex gap-1.5">
      {options.map((amount) => (
        <button
          key={amount}
          type="button"
          onClick={() => onSelect(amount)}
          className="flex-1 rounded-lg border border-border/60 bg-transparent px-2.5 py-1.5 text-xs font-medium tabular-nums text-muted-foreground transition-all hover:border-primary hover:bg-primary/5 hover:text-foreground"
        >
          {"\u20AC"}{amount.toFixed(2)}
        </button>
      ))}
    </div>
  );
}
