import type { ReactNode } from "react";
import { Panel, type PanelColor } from "./panel";
import { DisplayHeading } from "./display-heading";

/**
 * Slotpaneel (referentie gele/blauwe afsluiters): full-bleed pastelpaneel,
 * reusachtige uppercase kop, korte tekst en knoppen.
 */
export function ClosingCta({ title, text, children, color = "yellow", id }: { title: string; text?: ReactNode; children?: ReactNode; color?: PanelColor; id?: string }) {
  return (
    <Panel color={color} padding="lg" id={id} className="pb-0">
      <div className="flex flex-col items-center gap-7 text-center">
        <DisplayHeading tag="h2" size={1} text={title} className="mx-auto max-w-[1040px] text-center" />
        {text && <div className="cc-prose max-w-[32rem] text-base lg:text-lg">{text}</div>}
        {children && <div className="flex flex-wrap items-center justify-center gap-3">{children}</div>}
      </div>
    </Panel>
  );
}
