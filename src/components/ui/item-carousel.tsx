"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Gavel, Tag, ShoppingBag, Clock } from "lucide-react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { CarouselItem } from "@/lib/recommendations";

interface ItemCarouselProps {
  title: string;
  items: CarouselItem[];
}

export function ItemCarousel({ title, items }: ItemCarouselProps) {
  const t = useTranslations("carousel");
  const scrollRef = useRef<HTMLDivElement>(null);

  if (items.length === 0) return null;

  function scroll(direction: "left" | "right") {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.7;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <div className="flex gap-1">
          <button
            onClick={() => scroll("left")}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Scroll left"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Scroll right"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth pb-2 scrollbar-none"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {items.map((item) => (
          <CarouselCard key={`${item.type}-${item.id}`} item={item} />
        ))}
      </div>
    </section>
  );
}

function safeParseImageUrls(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function CarouselCard({ item }: { item: CarouselItem }) {
  const images = safeParseImageUrls(item.imageUrls);
  const firstImage = images[0];

  const href =
    item.type === "auction"
      ? `/veilingen/${item.id}`
      : item.type === "listing"
        ? `/marktplaats/${item.id}`
        : `/claimsales/${item.id}`;

  const TypeIcon =
    item.type === "auction" ? Gavel : item.type === "listing" ? Tag : ShoppingBag;

  const typeBadgeColor =
    item.type === "auction"
      ? "bg-primary text-white"
      : item.type === "listing"
        ? "bg-emerald-500 text-white"
        : "bg-blue-500 text-white";

  return (
    <Link
      href={href}
      className="group glass flex-shrink-0 w-48 overflow-hidden rounded-2xl transition-all hover:shadow-lg hover:scale-[1.02]"
    >
      {/* Image */}
      <div className="relative h-32 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
        {firstImage ? (
          <Image
            src={firstImage}
            alt={item.title}
            fill
            className="object-cover"
            sizes="192px"
          />
        ) : (
          <TypeIcon className="size-8 text-slate-300 dark:text-slate-600" />
        )}

        {/* Type badge */}
        <div className="absolute top-2 left-2">
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${typeBadgeColor}`}>
            {item.type === "auction"
              ? "Veiling"
              : item.type === "listing"
                ? "Marktplaats"
                : "Claimsale"}
          </span>
        </div>

        {/* Countdown for auctions */}
        {item.type === "auction" && item.endTime && (
          <div className="absolute top-2 right-2">
            <MiniCountdown endTime={item.endTime} />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3">
        <h3 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight">
          {item.title}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
          {item.sellerName}
        </p>
        {item.price !== null && (
          <p className="mt-1.5 text-sm font-bold text-foreground">
            &euro;{item.price.toFixed(2)}
          </p>
        )}
      </div>
    </Link>
  );
}

function MiniCountdown({ endTime }: { endTime: Date | string }) {
  const end = typeof endTime === "string" ? new Date(endTime) : endTime;
  const diff = end.getTime() - Date.now();
  if (diff <= 0) return null;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  return (
    <div className="flex items-center gap-0.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-mono text-white backdrop-blur-sm">
      <Clock className="size-2.5" />
      <span>
        {days > 0 ? `${days}d` : `${hours}h`}
      </span>
    </div>
  );
}
