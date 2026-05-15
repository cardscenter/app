import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { parseImageUrls } from "@/lib/upload";
import { Trophy, X, Clock } from "lucide-react";

export type PastBidStatus = "WON" | "LOST" | "OUTBID";

interface PastBidRowProps {
  auction: {
    id: string;
    title: string;
    imageUrls: string | null;
    currentBid: number | null;
    finalPrice: number | null;
    status: string;
  };
  yourBid: number;
  outcome: PastBidStatus;
}

const STATUS_META: Record<PastBidStatus, { label: string; tone: string; Icon: typeof Trophy }> = {
  WON: {
    label: "Gewonnen",
    tone: "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
    Icon: Trophy,
  },
  LOST: {
    label: "Verloren",
    tone: "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30",
    Icon: X,
  },
  OUTBID: {
    label: "Overboden",
    tone: "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
    Icon: Clock,
  },
};

function formatEuro(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `€${n.toFixed(2).replace(".", ",")}`;
}

export function PastBidRow({ auction, yourBid, outcome }: PastBidRowProps) {
  const images = auction.imageUrls ? parseImageUrls(auction.imageUrls) : [];
  const firstImage = images[0];
  const meta = STATUS_META[outcome];
  const Icon = meta.Icon;
  const winningBid = auction.finalPrice ?? auction.currentBid;

  return (
    <Link
      href={`/veilingen/${auction.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-muted/40"
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {firstImage ? (
          <Image src={firstImage} alt={auction.title} fill sizes="64px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
            Geen foto
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
          {auction.title}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          <span>Jouw bod: <span className="font-medium text-foreground tabular-nums">{formatEuro(yourBid)}</span></span>
          <span className="mx-1.5 text-border">·</span>
          <span>{outcome === "WON" ? "Winnend bod" : "Eindbod"}: <span className="font-medium text-foreground tabular-nums">{formatEuro(winningBid)}</span></span>
        </p>
      </div>

      <span
        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${meta.tone}`}
      >
        <Icon className="h-3 w-3" />
        {meta.label}
      </span>
    </Link>
  );
}
