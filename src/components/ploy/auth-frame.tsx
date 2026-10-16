import type { ReactNode } from "react";
import { PunchCard } from "./punch-card";
import { FloatingBalloon } from "./balloon";

/**
 * Kader voor inlog-, registratie- en bevestigingsschermen (design-pass):
 * lichte achtergrond met zwevende ballonnen in de hoeken en een gecentreerde
 * witte punch-card. De inhoud (kop, formulier) komt van de aanroeper.
 */
export function AuthFrame({ children, width = "md", className = "" }: { children: ReactNode; width?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const max = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-xl", xl: "max-w-2xl" }[width];
  return (
    <div className={`cc-landing relative flex min-h-[calc(100dvh-var(--site-nav-offset))] items-start justify-center overflow-clip px-4 pb-16 pt-6 sm:px-6 sm:pt-10 lg:pt-14 ${className}`}>
      <FloatingBalloon color="red" shape="cloud" className="pointer-events-none absolute -left-16 top-10 w-44 opacity-90 sm:w-64 lg:left-[6%]" duration={13} />
      <FloatingBalloon color="yellow" shape="flower" className="pointer-events-none absolute -right-12 top-[30%] w-36 opacity-90 sm:w-52 lg:right-[8%]" duration={17} />
      <FloatingBalloon color="blue" shape="stack" className="pointer-events-none absolute bottom-6 left-[12%] hidden w-40 lg:block" duration={15} />
      <FloatingBalloon color="pink" shape="cloud" className="pointer-events-none absolute -bottom-10 right-[18%] hidden w-32 lg:block" duration={11} />
      <PunchCard className={`relative z-[1] w-full bg-white p-6 shadow-[0_24px_60px_-30px_rgba(32,32,32,0.35)] sm:p-8 lg:p-10 ${max}`} dot="var(--border)">
        {children}
      </PunchCard>
    </div>
  );
}
