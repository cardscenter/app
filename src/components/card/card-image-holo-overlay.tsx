"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Diagonale regenboog-glans over de kaartafbeelding wanneer de gebruiker in
 * het prijs-paneel de Reverse Holo-variant selecteert. We hebben geen aparte
 * RH-scans (PokeWallet levert één afbeelding per kaart), dus deze overlay
 * maakt visueel duidelijk wélke variant je bekijkt.
 *
 * Koppeling met CardPricePanel via een custom DOM-event ("card-variant-
 * changed") — zelfde patroon als de cart-checkout-locked events. Zo hoeven
 * de server-gerenderde afbeelding en het client-paneel geen gedeelde state.
 */
export function CardImageHoloOverlay() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const key = (e as CustomEvent<{ variantKey?: string }>).detail?.variantKey;
      setActive(key === "reverse");
    };
    window.addEventListener("card-variant-changed", handler);
    return () => window.removeEventListener("card-variant-changed", handler);
  }, []);

  return (
    <div
      aria-hidden
      className={cn(
        "holo-overlay pointer-events-none absolute inset-0 z-10 transition-opacity duration-700",
        active ? "opacity-100" : "opacity-0",
      )}
    />
  );
}
