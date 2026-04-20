"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { cardSlug } from "@/lib/card-helpers";

export interface MarqueeCard {
  id: string;
  name: string;
  localId: string;
  setSlug: string;
  imageUrl: string | null;
  priceAvg: number | null;
}

interface Props {
  items: MarqueeCard[];
}

const AUTO_SCROLL_PX_PER_SECOND = 40;
const MOMENTUM_DECAY_PER_FRAME = 0.95;
const DRAG_CLICK_THRESHOLD_PX = 6;

function Tile({ card, draggingRef }: { card: MarqueeCard; draggingRef: React.MutableRefObject<boolean> }) {
  return (
    <Link
      href={`/kaarten/${card.setSlug}/${cardSlug(card.name, card.localId)}`}
      className="group relative block shrink-0"
      draggable={false}
      onClick={(e) => {
        if (draggingRef.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <div className="relative aspect-[5/7] w-[160px] overflow-hidden rounded-xl bg-muted shadow-md transition-transform group-hover:-translate-y-1 group-hover:shadow-xl">
        {card.imageUrl && (
          <Image
            src={card.imageUrl}
            alt={card.name}
            fill
            className="object-cover"
            sizes="160px"
            unoptimized
            draggable={false}
          />
        )}
      </div>
      {card.priceAvg != null && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-bold text-foreground shadow">
          €{card.priceAvg.toFixed(2)}
        </div>
      )}
    </Link>
  );
}

/**
 * Horizontal marquee using transform: translateX instead of native scroll.
 * Avoids mobile browser quirks with programmatic scrollLeft and eliminates
 * the scrollbar entirely. Auto-scrolls via rAF, grabbable + throwable with
 * mouse or touch.
 */
export function DatabaseMarquee({ items }: Props) {
  const outerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);        // current translateX in pixels (positive = shifted left)
  const halfWidthRef = useRef(0);     // width of a single copy of the items
  const rafRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const draggedEnoughRef = useRef(false);
  const pendingPointerRef = useRef<number | null>(null);
  const dragStartRef = useRef({ x: 0, offset: 0 });
  const lastMoveRef = useRef({ x: 0, time: 0 });
  const velocityRef = useRef(0);      // px/sec
  const [isGrabbing, setIsGrabbing] = useState(false);

  // Measure the width of one items-copy after mount + when window resizes.
  // The track contains items rendered twice, so halfWidth = scrollWidth / 2.
  useLayoutEffect(() => {
    const measure = () => {
      const track = trackRef.current;
      if (track) halfWidthRef.current = track.scrollWidth / 2;
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (trackRef.current) ro.observe(trackRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [items]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let lastTime = performance.now();
    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      if (!isDraggingRef.current) {
        if (Math.abs(velocityRef.current) > 5) {
          // Momentum fling
          offsetRef.current += velocityRef.current * dt;
          velocityRef.current *= Math.pow(MOMENTUM_DECAY_PER_FRAME, dt * 60);
        } else {
          velocityRef.current = 0;
          offsetRef.current += AUTO_SCROLL_PX_PER_SECOND * dt;
        }
      }

      // Wrap seamlessly at halfWidth
      const half = halfWidthRef.current;
      if (half > 0) {
        if (offsetRef.current >= half) offsetRef.current -= half;
        else if (offsetRef.current < 0) offsetRef.current += half;
      }

      track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Record start but don't capture pointer yet — a plain click/tap without
    // movement should still navigate.
    pendingPointerRef.current = e.pointerId;
    dragStartRef.current = { x: e.clientX, offset: offsetRef.current };
    lastMoveRef.current = { x: e.clientX, time: performance.now() };
    velocityRef.current = 0;
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const isPending = pendingPointerRef.current === e.pointerId;
    if (!isDraggingRef.current && !isPending) return;
    const dx = e.clientX - dragStartRef.current.x;

    if (!isDraggingRef.current) {
      if (Math.abs(dx) < DRAG_CLICK_THRESHOLD_PX) return;
      isDraggingRef.current = true;
      draggedEnoughRef.current = true;
      setIsGrabbing(true);
      try { outerRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }

    offsetRef.current = dragStartRef.current.offset - dx;
    const now = performance.now();
    const dt = (now - lastMoveRef.current.time) / 1000;
    if (dt > 0) {
      velocityRef.current = -(e.clientX - lastMoveRef.current.x) / dt;
    }
    lastMoveRef.current = { x: e.clientX, time: now };
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    pendingPointerRef.current = null;
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsGrabbing(false);
    try { outerRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    setTimeout(() => { draggedEnoughRef.current = false; }, 0);
  }

  if (items.length === 0) return null;

  return (
    <div
      ref={outerRef}
      className={`relative overflow-hidden py-6 select-none ${isGrabbing ? "cursor-grabbing" : "cursor-grab"}`}
      style={{
        maskImage:
          "linear-gradient(to right, transparent, black 64px, black calc(100% - 64px), transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 64px, black calc(100% - 64px), transparent)",
        touchAction: "pan-y",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        ref={trackRef}
        className="flex gap-4 w-max will-change-transform"
        style={{ transform: "translate3d(0, 0, 0)" }}
      >
        {[...items, ...items].map((c, i) => (
          <Tile key={`${c.id}-${i}`} card={c} draggingRef={draggedEnoughRef} />
        ))}
      </div>
    </div>
  );
}
