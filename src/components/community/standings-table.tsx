import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { StandingView } from "@/lib/community/league";

/** Ranglijst-tabel (publiek + dashboard). Server component. */
export async function StandingsTable({ rows, compact = false }: { rows: StandingView[]; compact?: boolean }) {
  const t = await getTranslations("community");
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">#</th>
            <th className="px-4 py-3 text-left">{t("player")}</th>
            <th className="px-4 py-3 text-right">{t("points")}</th>
            {!compact && <th className="hidden px-4 py-3 text-right sm:table-cell">{t("record")}</th>}
            <th className="px-4 py-3 text-right">{t("eventsPlayed")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.userId} className={r.isViewer ? "bg-primary/5" : ""}>
              <td className="px-4 py-3 font-semibold tabular-nums">
                {r.rank <= 3 ? <span className="mr-1">{["🥇", "🥈", "🥉"][r.rank - 1]}</span> : null}
                {r.rank}
              </td>
              <td className="px-4 py-3">
                <Link href={`/spelers/${r.userId}`} className="inline-flex items-center gap-2 font-medium hover:underline">
                  <UserAvatar src={r.avatarUrl} name={r.displayName} size="xs" />
                  {r.displayName}
                  {r.isViewer && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{t("you")}</span>}
                </Link>
              </td>
              <td className="px-4 py-3 text-right text-base font-bold tabular-nums">{r.points}</td>
              {!compact && (
                <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground sm:table-cell">
                  {r.wins}-{r.losses}-{r.draws}
                </td>
              )}
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{r.events}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
