import type { ReactNode } from "react";
import { Panel } from "./panel";

/**
 * Donkere promo-strook (referentie "See your first … in 60 seconds"):
 * eyebrow, kop en tekst links, knop + geruststelling rechts.
 */
export function BannerPromo({ eyebrow, title, text, action, note, id }: { eyebrow?: string; title: string; text?: ReactNode; action: ReactNode; note?: string; id?: string }) {
  return (
    <Panel color="ink" padding="sm" id={id}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
        <div className="max-w-[36rem]">
          {eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/55">{eyebrow}</p>}
          <h2 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.04em] text-white md:text-[36px]">{title}</h2>
          {text && <div className="mt-3 text-base text-white/70">{text}</div>}
        </div>
        <div className="flex flex-col items-start gap-2 lg:items-end">
          {action}
          {note && <span className="text-xs text-white/50">{note}</span>}
        </div>
      </div>
    </Panel>
  );
}
