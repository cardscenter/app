import type { ReactNode } from "react";
import { RollingNumber } from "@/components/ploy/rolling-number";
import { Pill } from "@/components/ploy/pill";
import { StampCardVisual } from "@/components/community/stamp-card-visual";

const TILE = "flex min-w-0 flex-col overflow-hidden rounded-[12px] bg-white p-6 shadow-[0_2px_8px_0_var(--cc-border-subtle)] max-lg:p-5";

/** Kop van een kaart: logo + donkere pil in de accentkleur, rechts optioneel iets extra's. */
function TileHead({ badge, accent, aside }: { badge: string; accent: string; aside?: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/logo-white-bg.png" alt="" className="h-5 w-auto" />
      <span className="cc-pill inline-flex h-7 items-center px-2.5 text-xs font-semibold" style={{ background: "var(--cc-ink)", color: accent }}>
        {badge}
      </span>
      {aside && <span className="ml-auto">{aside}</span>}
    </div>
  );
}

/** Statusregel onderaan met een pulserende stip. */
function TileStatus({ text, ink }: { text: string; ink: string }) {
  return (
    <div className="mt-auto flex items-center gap-3 pt-5">
      <span className="relative size-5 shrink-0" aria-hidden>
        <span className="cc-ring absolute inset-0 rounded-full" style={{ background: ink, opacity: 0.2 }} />
        <span className="cc-pulse absolute left-[7px] top-[7px] size-1.5 rounded-full" style={{ background: ink }} />
      </span>
      <p className="text-sm font-semibold text-[var(--cc-ink)]">{text}</p>
    </div>
  );
}

/**
 * Stempelkaart-kaart op de homepage. Ingelogd: de eigen kaart in het eigen
 * stempelpatroon (`seed`); uitgelogd: een voorbeeldkaart.
 */
export function StampCardTile({
  badge,
  heading,
  filled,
  total,
  seed,
  reward,
  status,
}: {
  badge: string;
  heading: string;
  filled: number;
  total: number;
  seed: string;
  reward: string;
  status: string;
}) {
  return (
    <div className={TILE}>
      <TileHead
        badge={badge}
        accent="var(--cc-yellow)"
        aside={
          <Pill tone="pastel" color="yellow">
            {filled} / {total}
          </Pill>
        }
      />
      <p className="mt-4 text-sm font-semibold text-[var(--cc-ink)]">{heading}</p>
      <StampCardVisual total={total} filled={filled} seed={seed} className="mt-4" />
      <div className="mt-5 rounded-[6px] bg-[var(--cc-surface-2)] p-3">
        <p className="text-xs font-medium leading-[1.65] text-[var(--cc-ink)]/60">{reward}</p>
      </div>
      <TileStatus text={status} ink="var(--cc-yellow-ink)" />
    </div>
  );
}

/**
 * Spaarpunten-kaart op de homepage: groot getal (eigen saldo of punten per
 * check-in), hoe je punten verdient en hoe je ze inwisselt.
 */
export function PointsTile({
  badge,
  value,
  prefix,
  label,
  earn,
  redeemTitle,
  redeemText,
  status,
}: {
  badge: string;
  value: number;
  prefix?: string;
  label: string;
  earn: { label: string; points: number }[];
  redeemTitle: string;
  redeemText: string;
  status: string;
}) {
  return (
    <div className={TILE}>
      <TileHead badge={badge} accent="var(--cc-green)" />
      <p className="mt-4 text-[64px] font-bold leading-[0.86] tracking-[-0.04em] text-[var(--cc-ink)] lg:text-7xl">
        <RollingNumber value={value} prefix={prefix} delay={450} />
      </p>
      <p className="mt-1 text-sm font-semibold text-[var(--cc-ink)]">{label}</p>
      {earn.length > 0 && (
        <ul className="mt-5 divide-y divide-[var(--cc-border-subtle)]">
          {earn.map((e) => (
            <li key={e.label} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-sm text-[var(--cc-ink)]/70">{e.label}</span>
              <Pill tone="pastel" color="green">
                +{e.points}
              </Pill>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 rounded-[6px] bg-[var(--cc-surface-2)] p-3">
        <p className="text-xs font-semibold text-[var(--cc-ink)]">{redeemTitle}</p>
        <p className="mt-1 text-xs font-medium leading-[1.65] text-[var(--cc-ink)]/60">{redeemText}</p>
      </div>
      <TileStatus text={status} ink="var(--cc-green-ink)" />
    </div>
  );
}
