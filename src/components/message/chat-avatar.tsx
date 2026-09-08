"use client";

import { useEffect, useRef, useState } from "react";

// Ronde avatar met initiaal-fallback; valt óók terug op de initiaal als de
// afbeelding niet laadt (verwijderde upload, seed-URL), zodat er nooit een
// kapot plaatje in de gesprekslijst of gesprekskop staat. Omdat een SSR-<img>
// al vóór hydratie kan falen (onError wordt dan niet afgevuurd), checken we
// bij mount ook `complete && naturalWidth === 0`.
export function ChatAvatar({
  src,
  initial,
  size = "md",
  emphasis = false,
}: {
  src: string | null | undefined;
  initial: string;
  size?: "sm" | "md";
  emphasis?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, [src]);

  const sizeClass = size === "sm" ? "size-9 text-sm" : "size-10 text-sm";
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={imgRef}
        src={src}
        alt=""
        onError={() => setFailed(true)}
        className={`${sizeClass} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <span
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full font-bold ${
        emphasis ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
      }`}
    >
      {initial}
    </span>
  );
}
