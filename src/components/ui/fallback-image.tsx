"use client";

import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Vullende afbeelding met nette fallback (profiel-redesign sept 2026): bij
 * een kapotte URL (verwijderde upload, seed-plaatje) verschijnt een subtiel
 * icoon op de tint-achtergrond i.p.v. het broken-image-icoon van de browser.
 * Voor tegels waarvan de bron niet gegarandeerd bestaat.
 */
export function FallbackImage({ src, alt = "", className }: { src: string | null; alt?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={cn("flex size-full items-center justify-center text-muted-foreground/40", className)}>
        <ImageIcon className="size-10" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("absolute inset-0 size-full object-cover", className)}
    />
  );
}
