import type { ReactNode } from "react";
import { DisplayHeading } from "./display-heading";
import { Pill, type PastelColor } from "./pill";

/**
 * Sectiekop op de lichte achtergrond: optionele eyebrow-pil, display-kop
 * links en intro of actie rechts (zelfde ritme als FeatureRows/PhaseLadder).
 * Voor losse secties die geen paneel nodig hebben (ranglijst, nieuws-grid).
 */
export function SectionHead({ eyebrow, eyebrowColor = "blue", title, intro, action, size = 3, className = "" }: { eyebrow?: string; eyebrowColor?: PastelColor; title: string; intro?: ReactNode; action?: ReactNode; size?: 2 | 3 | 4; className?: string }) {
  return (
    <div className={`mb-8 flex flex-col gap-5 lg:mb-10 lg:flex-row lg:items-end lg:justify-between ${className}`}>
      <div className="flex flex-col items-start gap-4">
        {eyebrow && <Pill color={eyebrowColor}>{eyebrow}</Pill>}
        <DisplayHeading tag="h2" size={size} text={title} className="max-w-[30rem]" />
      </div>
      {(intro || action) && (
        <div className="flex flex-col items-start gap-4 lg:items-end lg:text-right">
          {intro && <div className="cc-prose max-w-[26rem] text-base lg:text-left">{intro}</div>}
          {action}
        </div>
      )}
    </div>
  );
}
