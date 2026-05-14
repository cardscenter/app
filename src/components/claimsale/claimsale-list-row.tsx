import Image from "next/image";
import Link from "next/link";
import { Tag, Truck, Clock } from "lucide-react";
import { parseImageUrls } from "@/lib/upload";
import { SellerLocationLine } from "@/components/ui/seller-location-line";
import { WatchlistButton } from "@/components/ui/watchlist-button";
import { ClaimsaleLabels, type ClaimsaleLabelData } from "./claimsale-labels";
import { ClaimsalePreviewCarousel } from "./claimsale-preview-carousel";

// Standaard (gratis) preview-strip: 5 kaart-thumbnails — voor iedereen.
const PREVIEW_THUMBNAILS = 5;
// Geavanceerde Kaart-Preview-Rij (betaalde ITEM_PREVIEW-upsell): 2-rijs
// carousel met maximaal 50 thumbnails.
const ADVANCED_PREVIEW_MAX = 50;

interface ClaimsaleItemPreview {
  id: string;
  cardName: string;
  condition: string;
  price: number;
  imageUrls: string;
  status: string;
}

interface ClaimsaleUpsellPreview {
  type: string;
  startsAt: Date;
  expiresAt: Date;
}

interface ClaimsaleListRowProps {
  claimsale: {
    id: string;
    title: string;
    description: string | null;
    coverImage: string | null;
    shippingCost: number;
    publishedAt: Date | null;
    status?: string;
    startTime?: Date | null;
    labels?: ClaimsaleLabelData[];
    upsells?: ClaimsaleUpsellPreview[];
    seller: {
      id?: string;
      displayName: string;
      isVerified?: boolean;
      city?: string | null;
      postalCode?: string | null;
      country?: string | null;
    };
    _count: { items: number };
    items: ClaimsaleItemPreview[];
  };
  locale: string;
  buyer?: { country: string | null; postalCode: string | null } | null;
  initialWatched?: boolean;
  showWatchlist?: boolean;
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

function relativeTime(date: Date | null): string {
  if (!date) return "";
  const ms = Date.now() - date.getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "Net gepubliceerd";
  if (min < 60) return `${min} min geleden`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} uur geleden`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} dag${d === 1 ? "" : "en"} geleden`;
  if (d < 30) {
    const w = Math.floor(d / 7);
    return `${w} week${w === 1 ? "" : "en"} geleden`;
  }
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} maand${mo === 1 ? "" : "en"} geleden`;
  const y = Math.floor(d / 365);
  return `${y} jaar geleden`;
}

export function ClaimsaleListRow({
  claimsale,
  locale,
  buyer,
  initialWatched = false,
  showWatchlist = true,
}: ClaimsaleListRowProps) {
  const totalItems = claimsale._count.items;
  const availableItems = claimsale.items;
  const availableCount = availableItems.length;
  const claimedPct = totalItems > 0
    ? Math.round(((totalItems - availableCount) / totalItems) * 100)
    : 0;

  // Prijsrange op AVAILABLE items.
  const prices = availableItems.map((i) => i.price);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const priceRangeText =
    prices.length === 0
      ? "—"
      : minPrice === maxPrice
        ? `€${minPrice.toFixed(2)}`
        : `€${minPrice.toFixed(2)} – €${maxPrice.toFixed(2)}`;

  const isScheduled = claimsale.status === "SCHEDULED";

  // Geavanceerde Kaart-Preview-Rij = betaalde ITEM_PREVIEW-upsell (2-rijs
  // carousel, tot 50 kaarten). Zonder upsell tonen we de gratis 5-item strip.
  const now = Date.now();
  const hasAdvancedPreview = (claimsale.upsells ?? []).some(
    (u) =>
      u.type === "ITEM_PREVIEW" &&
      new Date(u.startsAt).getTime() <= now &&
      new Date(u.expiresAt).getTime() > now
  );

  // Alle AVAILABLE items met een afbeelding.
  const imagedItems = availableItems
    .map((item) => {
      const urls = parseImageUrls(item.imageUrls);
      return urls.length > 0 ? { ...item, firstImage: urls[0] } : null;
    })
    .filter((x): x is ClaimsaleItemPreview & { firstImage: string } => x !== null);

  const carouselItems = imagedItems.slice(0, ADVANCED_PREVIEW_MAX);
  const previewItems = imagedItems.slice(0, PREVIEW_THUMBNAILS);
  const remainingItems = availableCount - previewItems.length;

  return (
    <article className="group relative flex flex-row gap-3 sm:gap-5 rounded-2xl border border-border bg-card p-3 sm:p-4 shadow-card transition-shadow hover:shadow-card-hover">
      {/* IMAGE — cover van de claimsale */}
      <div className="relative shrink-0">
        <Link
          href={`/${locale}/claimsales/${claimsale.id}`}
          className="block relative w-24 h-32 sm:w-40 sm:h-48 overflow-hidden rounded-xl bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-800 dark:to-slate-900"
        >
          {claimsale.coverImage ? (
            <Image
              src={claimsale.coverImage}
              alt={claimsale.title}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 640px) 96px, 160px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Tag className="size-8 text-slate-300 dark:text-slate-600" />
            </div>
          )}
          {/* Aantal items pill linksboven — of SCHEDULED start-pill */}
          {isScheduled && claimsale.startTime ? (
            <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
              <Clock className="h-2.5 w-2.5" />
              {formatStartPill(claimsale.startTime)}
            </span>
          ) : (
            <span className="absolute left-1.5 top-1.5 rounded-md bg-amber-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
              {totalItems} kaarten
            </span>
          )}
        </Link>

        {showWatchlist && (
          <div className="absolute right-1 top-1 sm:hidden">
            <div className="rounded-full bg-background/90 p-0.5 shadow-md backdrop-blur">
              <WatchlistButton
                claimsaleId={claimsale.id}
                initialWatched={initialWatched}
              />
            </div>
          </div>
        )}
      </div>

      {/* BODY */}
      <div className="flex flex-1 min-w-0 flex-col">
        <Link href={`/${locale}/claimsales/${claimsale.id}`} className="block">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm sm:text-base font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
              {claimsale.title}
            </h3>
            <span className="hidden sm:block shrink-0 text-xs text-muted-foreground tabular-nums">
              {relativeTime(claimsale.publishedAt)}
            </span>
          </div>
        </Link>

        {claimsale.labels && claimsale.labels.length > 0 && (
          <ClaimsaleLabels labels={claimsale.labels} size="md" className="mt-2" />
        )}

        {/* Voortgang-bar — visueel duidelijk maken hoe vol/leeg de pot is.
            Amber = "claimsale" kleur, dezelfde tint als de create-knop. */}
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-amber-500 transition-all"
              style={{
                width: `${Math.min(100, Math.max(2, ((totalItems - availableCount) / Math.max(totalItems, 1)) * 100))}%`,
              }}
              aria-label={`${claimedPct}% al geclaimed`}
            />
          </div>
          <span className="shrink-0 text-[11px] font-medium text-muted-foreground tabular-nums">
            {availableCount}/{totalItems} beschikbaar
          </span>
        </div>

        {/* Item-preview strip — TCG-kaart-thumbnails uit AVAILABLE items.
            flex-nowrap + overflow-hidden zodat brede schermen de volledige
            breedte vullen, smallere het einde clippen (info is in de
            voortgang-bar al gegeven). */}
        {/* Geavanceerde Kaart-Preview-Rij (betaald): 2-rijs carousel */}
        {hasAdvancedPreview && carouselItems.length > 0 && (
          <div className="hidden sm:block">
            <ClaimsalePreviewCarousel
              items={carouselItems}
              claimsaleId={claimsale.id}
              locale={locale}
            />
          </div>
        )}

        {/* Gratis standaard preview-strip — 5 kaarten, voor iedereen */}
        {!hasAdvancedPreview && previewItems.length > 0 && (
          <div className="mt-3 hidden sm:flex flex-nowrap items-start gap-2 overflow-hidden">
            {previewItems.map((item) => (
              <Link
                key={item.id}
                href={`/${locale}/claimsales/${claimsale.id}`}
                className="group/thumb relative flex w-24 shrink-0 flex-col gap-1.5"
                title={`${item.cardName} · ${item.condition} · €${item.price.toFixed(2)}`}
              >
                <div className="relative h-32 w-24 overflow-hidden rounded-sm bg-muted ring-1 ring-border transition-transform group-hover/thumb:scale-[1.04]">
                  <Image
                    src={item.firstImage}
                    alt={item.cardName}
                    fill
                    className="object-cover"
                    // 256px source voor 96px render zorgt dat retina-displays
                    // (2× DPR) een scherpe versie krijgen.
                    sizes="256px"
                    quality={90}
                  />
                </div>
                <span className="text-center text-xs font-semibold text-foreground tabular-nums">
                  €{item.price.toFixed(2)}
                </span>
              </Link>
            ))}
            {remainingItems > 0 && (
              <Link
                href={`/${locale}/claimsales/${claimsale.id}`}
                className="flex h-32 w-24 shrink-0 flex-col items-center justify-center rounded-sm border border-dashed border-border bg-muted/40 text-center text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                <span className="text-xl font-bold leading-none text-foreground">
                  +{remainingItems}
                </span>
                <span className="mt-1 leading-tight">meer</span>
              </Link>
            )}
          </div>
        )}

        {/* Mobile-only blok: prijsrange + verzendkosten */}
        <div className="sm:hidden mt-2 space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-base font-bold text-foreground tabular-nums">
              {priceRangeText}
            </p>
            <span className="text-[10px] text-muted-foreground">per kaart</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-1.5 py-0.5 text-sky-800 ring-1 ring-inset ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-800">
              <Truck className="size-3" />
              €{claimsale.shippingCost.toFixed(2)}
            </span>
            <span className="text-muted-foreground">{relativeTime(claimsale.publishedAt)}</span>
          </div>
        </div>

        {/* Desktop-only verzendkosten badge onder de preview. mb-3 garandeert
            adempauze tussen de pill en de scheidingslijn van de footer,
            ongeacht of mt-auto extra ruimte vult. */}
        <div className="hidden sm:flex mt-3 mb-3 items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800 ring-1 ring-inset ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-800">
            <Truck className="size-3.5" />
            Verzending €{claimsale.shippingCost.toFixed(2)}
          </span>
        </div>

        {/* FOOTER */}
        <div className="mt-auto pt-3 border-t border-border/60">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate font-medium text-foreground/80">
                {claimsale.seller.displayName}
              </span>
              {claimsale.seller.city && (
                <>
                  <span className="text-border">·</span>
                  <SellerLocationLine
                    seller={claimsale.seller}
                    buyer={buyer}
                    className="!mt-0"
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* DESKTOP RIGHT — prijsrange + watchlist + Bekijk-knop */}
      <div className="hidden sm:flex w-48 shrink-0 flex-col items-end justify-between border-l border-border pl-5">
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Prijs per kaart
          </p>
          <p className="text-xl font-bold leading-tight text-foreground tabular-nums">
            {priceRangeText}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {availableCount} {availableCount === 1 ? "kaart" : "kaarten"} nog vrij
          </p>
        </div>

        <div className="flex w-full items-center justify-end gap-2">
          {showWatchlist && (
            <WatchlistButton
              claimsaleId={claimsale.id}
              initialWatched={initialWatched}
            />
          )}
          <Link
            href={`/${locale}/claimsales/${claimsale.id}`}
            className="rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-amber-700"
          >
            Bekijk items
          </Link>
        </div>
      </div>
    </article>
  );
}
