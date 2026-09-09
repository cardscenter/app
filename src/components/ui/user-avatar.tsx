"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Dé avatar van de site (profiel-redesign sept 2026): afgeronde hoeken
 * (`rounded-[22%]`, schaalt mee met de maat) i.p.v. een cirkel — overal, van
 * de 20px-verkoperregel op kaarten tot de 176px-profielfoto. Fallback op de
 * initiaal wanneer er geen foto is óf de foto niet laadt (verwijderde upload,
 * seed-URL). SSR-<img> kan al vóór hydratie gefaald zijn (onError vuurt dan
 * niet), vandaar de `complete && naturalWidth === 0`-check bij mount.
 */
export const AVATAR_RADIUS = "rounded-[22%]";

const SIZES = {
  xs: "size-5 text-[10px]",
  sm: "size-7 text-xs",
  md: "size-9 text-sm",
  lg: "size-12 text-base",
  xl: "size-16 text-xl",
  "2xl": "size-24 text-3xl",
  "3xl": "size-32 text-4xl",
  "4xl": "size-44 text-5xl",
} as const;

export type UserAvatarSize = keyof typeof SIZES;

type Props = {
  src: string | null | undefined;
  /** Naam voor de initiaal-fallback (volledige naam of gebruikersnaam). */
  name: string;
  size?: UserAvatarSize;
  /** Extra klassen op het buitenste element (ring, marge, …). */
  className?: string;
  /** Sterkere fallback-kleur (bv. eigen bericht in chat). */
  emphasis?: boolean;
  alt?: string;
};

export function UserAvatar({ src, name, size = "md", className, emphasis = false, alt = "" }: Props) {
  // Gefaalde bron onthouden i.p.v. een boolean: een nieuwe `src` reset dan
  // vanzelf zonder setState-in-effect.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = !!src && failedSrc === src;
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth === 0) setFailedSrc(el.getAttribute("src"));
  }, [src]);

  const base = cn("shrink-0 overflow-hidden", AVATAR_RADIUS, SIZES[size], className);

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onError={() => setFailedSrc(src)}
        className={cn(base, "object-cover")}
      />
    );
  }

  return (
    <span
      aria-hidden={alt === ""}
      className={cn(
        base,
        "flex select-none items-center justify-center font-bold",
        // Dekkend (geen /10-tint): de avatar valt op het profiel over de omslag.
        emphasis ? "bg-primary text-primary-foreground" : "bg-muted text-primary",
      )}
    >
      {(name.trim().charAt(0) || "?").toUpperCase()}
    </span>
  );
}
