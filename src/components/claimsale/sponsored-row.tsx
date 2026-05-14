import { ClaimsaleCard, type ClaimsaleCardData } from "@/components/claimsale/claimsale-card";
import { Info } from "lucide-react";

interface SponsoredClaimsaleRowProps {
  claimsales: ClaimsaleCardData[];
  title: string;
  tooltip: string;
  buyer?: { country: string | null; postalCode: string | null } | null;
}

export function SponsoredClaimsaleRow({
  claimsales,
  title,
  tooltip,
  buyer,
}: SponsoredClaimsaleRowProps) {
  if (claimsales.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
        <div className="group relative">
          <Info className="h-4 w-4 cursor-help text-muted-foreground/60" />
          <div className="absolute bottom-full left-1/2 z-50 mb-2 hidden w-64 -translate-x-1/2 rounded-lg bg-foreground p-3 text-xs text-background shadow-lg group-hover:block">
            {tooltip}
            <div className="absolute left-1/2 top-full -mt-1 h-2 w-2 -translate-x-1/2 rotate-45 bg-foreground" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 [@media(min-width:1600px)]:grid-cols-6">
        {claimsales.slice(0, 6).map((cs, i) => {
          const visibility =
            i === 0
              ? ""
              : i === 1
                ? "hidden sm:block"
                : i === 2
                  ? "hidden lg:block"
                  : i === 3
                    ? "hidden xl:block"
                    : i === 4
                      ? "hidden 2xl:block"
                      : "hidden [@media(min-width:1600px)]:block";
          return (
            <div key={cs.id} className={visibility}>
              <ClaimsaleCard claimsale={cs} sponsored buyer={buyer} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
