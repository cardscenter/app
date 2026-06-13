"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Forceer scroll-naar-boven bij navigatie binnen de lange database-pagina's.
 *
 * Achtergrond: de Next.js App Router *behoudt* standaard de scrollpositie zolang
 * de nieuwe pagina "zichtbaar is in de viewport" (zie
 * node_modules/next/dist/docs/.../02-components/link.md, sectie `scroll`). Op
 * onze lange set-/kaartpagina's mét een `loading.tsx` pakt dit verkeerd uit:
 * Next toont eerst de korte loading-state en *herstelt* daarna — wanneer de
 * échte (lange) content binnenstreamt — je oude diepe scrollpositie op de nieuwe
 * pagina. Je landt dan onderaan i.p.v. bovenaan.
 *
 * Een reset bij enkel `pathname`-wijziging is daarom niet genoeg: die vuurt al
 * tijdens de loading-state, vóór Next z'n herstel. Daarom render je dit component
 * BOVENIN de page-content (niet in de layout) zodat het opnieuw mount precies
 * wanneer de gestreamde content commit — ná Next's herstel. De
 * `requestAnimationFrame` zorgt dat we ná Next's eigen scroll-afhandeling van
 * diezelfde commit draaien.
 */
export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    const id = requestAnimationFrame(() => window.scrollTo(0, 0));
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return null;
}
