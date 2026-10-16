import type { ReactNode } from "react";
import { Panel, type PanelColor } from "./panel";
import { DisplayHeading } from "./display-heading";

export interface PhaseStep {
  title: string;
  text: ReactNode;
}

/**
 * Stappenladder (referentie "How to identify website visitors"): gekleurd
 * paneel met display-titel links, intro rechts en een 2×2-grid van witte
 * stappenkaarten met een zwarte nummer-cirkel.
 */
export function PhaseLadder({ title, intro, steps, color = "blue", id }: { title: string; intro?: ReactNode; steps: PhaseStep[]; color?: PanelColor; id?: string }) {
  return (
    <Panel color={color} id={id}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
        <DisplayHeading tag="h2" size={3} text={title} className="max-w-[22rem]" />
        {intro && <div className="cc-prose max-w-[26rem] text-base lg:pt-2">{intro}</div>}
      </div>
      <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:mt-14">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-4 rounded-[12px] bg-white p-5 sm:p-6">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)] text-xs font-bold text-white">{String(i + 1).padStart(2, "0")}</span>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold leading-tight tracking-[-0.03em] text-[var(--foreground)]">{s.title}</h3>
              <div className="cc-prose mt-1.5 text-sm">{s.text}</div>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
