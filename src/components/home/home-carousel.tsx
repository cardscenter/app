"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface HomeCarouselProps {
  children: ReactNode;
  className?: string;
}

export function HomeCarousel({ children, className }: HomeCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      observer.disconnect();
    };
  }, []);

  function scroll(direction: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  }

  return (
    <div className={`relative group ${className ?? ""}`}>
      {/* Scroll arrows */}
      {canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 dark:bg-slate-800/90 shadow-lg backdrop-blur-sm border border-border transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
          aria-label="Scroll left"
        >
          <ChevronLeft className="size-5 text-foreground" />
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 dark:bg-slate-800/90 shadow-lg backdrop-blur-sm border border-border transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
          aria-label="Scroll right"
        >
          <ChevronRight className="size-5 text-foreground" />
        </button>
      )}

      {/* Edge fade indicators */}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-[1] pointer-events-none" />
      )}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-[1] pointer-events-none" />
      )}

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth pb-2 scrollbar-none snap-x snap-mandatory"
      >
        {children}
      </div>
    </div>
  );
}

export function CarouselSlide({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex-shrink-0 snap-start ${className ?? ""} w-[280px] sm:w-[calc(50%-8px)] lg:w-[calc(25%-12px)]`}>
      {children}
    </div>
  );
}
