import { Stamp } from "lucide-react";

/**
 * Visuele stempelkaart: een rondje per stempel, gevulde rondjes amber.
 * Puur presentatie; getallen komen uit `getLoyaltySummary`.
 */
export function StampCard({ onCard, perCard, label }: { onCard: number; perCard: number; label: string }) {
  const cells = Array.from({ length: perCard }, (_, i) => i < onCard);
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
      <div className="grid grid-cols-5 gap-2 sm:gap-3" role="img" aria-label={label}>
        {cells.map((filled, i) => (
          <div
            key={i}
            className={`flex aspect-square items-center justify-center rounded-full border-2 ${
              filled ? "border-amber-500 bg-amber-500 text-white shadow-sm" : "border-dashed border-amber-300 bg-card text-amber-300 dark:border-amber-500/40"
            }`}
          >
            {filled ? <Stamp className="size-5" /> : <span className="text-xs font-semibold">{i + 1}</span>}
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-sm font-medium text-amber-900 dark:text-amber-200">{label}</p>
    </div>
  );
}
