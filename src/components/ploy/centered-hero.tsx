"use client";

import type { ReactNode } from "react";
import { DisplayHeading } from "./display-heading";
import { Pill, type PastelColor } from "./pill";
import { withHighlight } from "./highlight";

/**
 * Client-component: `withHighlight` rendert client-only markup (framer) en mag
 * daarom niet vanuit een server component aangeroepen worden.
 *
 * Gecentreerde pagina-hero (feature-pagina's in de referentie): eyebrow-pil,
 * grote uppercase kop (optioneel met veegstreep op één woord), korte tekst en
 * een rij knoppen of pillen. Geen paneel: staat direct op de lichte achtergrond.
 */
export function CenteredHero({
  eyebrow,
  eyebrowColor = "blue",
  title,
  highlightWord,
  highlightColor,
  illustration,
  description,
  children,
  size = 2,
  className = "",
}: {
  eyebrow?: string;
  eyebrowColor?: PastelColor;
  title: string;
  highlightWord?: string;
  highlightColor?: PastelColor;
  illustration?: { src: string; alt?: string; clipBottom?: number };
  description?: ReactNode;
  children?: ReactNode;
  size?: 1 | 2 | 3;
  className?: string;
}) {
  const heading = highlightWord ? withHighlight(title, highlightWord, { color: highlightColor, illustration }) : title;
  return (
    <section className={`flex justify-center px-4 pb-12 pt-6 sm:px-5 lg:px-6 lg:pb-16 lg:pt-10 ${className}`}>
      <div className="flex w-full max-w-6xl flex-col items-center gap-6 text-center">
        {eyebrow && <Pill color={eyebrowColor}>{eyebrow}</Pill>}
        <DisplayHeading tag="h1" size={size} text={title} className="mx-auto max-w-[1040px] text-center">
          {heading}
        </DisplayHeading>
        {description && <div className="cc-prose max-w-[36rem] text-base lg:text-lg">{description}</div>}
        {children && <div className="flex flex-wrap items-center justify-center gap-3">{children}</div>}
      </div>
    </section>
  );
}
