"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Gedeelde scroll-spy voor de sticky chip-navs van de aanmaak-wizards
 * (veiling / claimsale / marktplaats).
 *
 * Waarom een eigen hook i.p.v. de IntersectionObserver die hier eerst stond:
 *
 * 1. De oude regel was "de bovenste sectie die de band `-30%/-55%` raakt".
 *    De callback krijgt alleen de *gewijzigde* entries, niet alle secties, dus
 *    tussen twee aangrenzende secties flipte `active` heen en weer.
 * 2. Elke flip triggerde `chip.scrollIntoView({ behavior: "smooth" })`. Die API
 *    scrollt ELKE scrollbare voorouder incl. het document — `block: "nearest"`
 *    is een uitlijn-hint, geen scope-beperking. Met `html { scroll-padding-top:
 *    5rem }` valt de sticky balk (top-16 = 4rem) binnen die padding, dus de
 *    browser trok het document elke keer ~16px omhoog. Dat gevecht met de
 *    scroll-gesture van de gebruiker was het "haken en vastlopen".
 *
 * De regel hier is monotoon in scroll-positie — de actieve stap is de LAATSTE
 * sectie waarvan de bovenkant boven de anker-lijn ligt — en kan dus per
 * definitie niet flip-floppen.
 */

/** Anker-lijn waar een sectie actief wordt: sticky header (4rem) + chip-strip. */
const ANCHOR_OFFSET = 140;

export function useFormScrollSpy<K extends string>(keys: readonly K[]) {
  const [active, setActive] = useState<K>(keys[0]);
  const activeRef = useRef<K>(keys[0]);
  const frameRef = useRef<number | null>(null);

  activeRef.current = active;

  useEffect(() => {
    const measure = () => {
      frameRef.current = null;

      let next = keys[0];
      for (const key of keys) {
        const el = document.querySelector<HTMLElement>(`[data-section="${key}"]`);
        // Secties kunnen conditioneel renderen; overslaan i.p.v. de reeks breken.
        if (!el) continue;
        if (el.getBoundingClientRect().top <= ANCHOR_OFFSET) next = key;
      }

      // De laatste sectie haalt de anker-lijn soms nooit als de pagina onderaan
      // is; onderaan wint hij alsnog zodat de laatste chip bereikbaar blijft.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        for (let i = keys.length - 1; i >= 0; i--) {
          if (document.querySelector(`[data-section="${keys[i]}"]`)) {
            next = keys[i];
            break;
          }
        }
      }

      if (next !== activeRef.current) setActive(next);
    };

    const onScroll = () => {
      // rAF-throttle: één meting per frame, nooit layout-thrash tijdens scrollen.
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [keys]);

  /** Klik op een chip: bewuste sprong van de gebruiker, dus wél scrollIntoView. */
  const scrollToSection = useCallback((key: K) => {
    const el = document.querySelector<HTMLElement>(`[data-section="${key}"]`);
    if (!el) return;
    // Chip meteen laten reageren; de spy corrigeert zodra de scroll landt.
    setActive(key);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return { active, scrollToSection };
}

/**
 * Centreert de actieve chip binnen de horizontale strip.
 *
 * Scrollt bewust ALLEEN het `<ol>`-element via `scrollTo`, nooit via
 * `scrollIntoView` — die zou het document mee-scrollen (zie hierboven).
 */
export function useChipStripAutoScroll(
  listRef: React.RefObject<HTMLElement | null>,
  active: string
) {
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    // Past alles op één regel (desktop), dan valt er niets te centreren.
    const maxScroll = list.scrollWidth - list.clientWidth;
    if (maxScroll <= 0) return;

    const btn = list.querySelector<HTMLElement>(`[data-step="${active}"]`);
    if (!btn) return;

    // Via rects i.p.v. offsetLeft: de sticky wrapper is een positioned ancestor,
    // dus offsetLeft is relatief aan de wrapper (incl. px-4), niet aan de strip.
    const listRect = list.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const delta = btnRect.left - listRect.left - (list.clientWidth - btnRect.width) / 2;
    const left = Math.max(0, Math.min(list.scrollLeft + delta, maxScroll));

    if (Math.abs(left - list.scrollLeft) < 2) return;
    list.scrollTo({ left, behavior: "smooth" });
  }, [active, listRef]);
}
