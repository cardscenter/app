import { Link } from "@/i18n/navigation";
import { PunchCard } from "@/components/ploy/punch-card";
import { Pill } from "@/components/ploy/pill";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { StandingView } from "@/lib/community/league";

const COLORS = ["var(--pastel-yellow)", "var(--pastel-blue)", "var(--pastel-pink)"] as const;

/**
 * Podium (design-pass): de top drie van de ranglijst als drie punch-cards met
 * de rang in de display-letter, avatar, naam en punten. De eerste kaart is
 * geel, de nummers twee en drie blauw en roze.
 */
export function Podium({ rows, pointsLabel, eventsLabel, youLabel }: { rows: StandingView[]; pointsLabel: string; eventsLabel: string; youLabel: string }) {
  const top = rows.slice(0, 3);
  if (top.length === 0) return null;
  return (
    <ol className="grid gap-4 sm:grid-cols-3">
      {top.map((r, i) => (
        <li key={r.userId}>
          <Link href={`/spelers/${r.userId}`} className="group block h-full no-underline">
            <PunchCard className="flex h-full flex-col justify-between gap-8 p-6 transition-transform duration-200 group-hover:-translate-y-0.5" style={{ background: COLORS[i] }} dot="rgba(32,32,32,0.18)">
              <div className="flex items-start justify-between">
                <span className="cc-display text-[72px] leading-none text-[var(--foreground)] lg:text-[88px]">{String(r.rank).padStart(2, "0")}</span>
                {r.isViewer && <Pill>{youLabel}</Pill>}
              </div>
              <div className="flex items-center gap-3">
                <UserAvatar src={r.avatarUrl} name={r.displayName} size="xl" className="ring-2 ring-white" />
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold leading-tight tracking-[-0.03em] text-[var(--foreground)]">{r.displayName}</p>
                  <p className="mt-0.5 text-sm text-[var(--foreground)]/65">
                    <span className="font-bold text-[var(--foreground)]">{r.points}</span> {pointsLabel} · {r.events} {eventsLabel}
                  </p>
                </div>
              </div>
            </PunchCard>
          </Link>
        </li>
      ))}
    </ol>
  );
}
