import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Pill } from "@/components/ploy/pill";
import type { StandingView } from "@/lib/community/league";

/**
 * Ranglijst-tabel (publiek + dashboard). Server component. Design-pass:
 * rang in de display-letter, smalle kopregel, rijen met lichte lijnen en
 * de kijker in een pastel-geel accent.
 */
export async function StandingsTable({ rows, compact = false }: { rows: StandingView[]; compact?: boolean }) {
  const t = await getTranslations("community");
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground)]/45">
            <th className="w-16 px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">{t("player")}</th>
            <th className="px-3 py-2 text-right">{t("points")}</th>
            {!compact && <th className="hidden px-3 py-2 text-right sm:table-cell">{t("record")}</th>}
            <th className="px-3 py-2 text-right">{t("eventsPlayed")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
          {rows.map((r) => (
            <tr key={r.userId} className={r.isViewer ? "bg-[var(--pastel-yellow)]/60" : ""}>
              <td className="px-3 py-3">
                <span className={`cc-display text-2xl leading-none ${r.rank <= 3 ? "text-[var(--primary)]" : "text-[var(--foreground)]/60"}`}>{String(r.rank).padStart(2, "0")}</span>
              </td>
              <td className="px-3 py-3">
                <Link href={`/spelers/${r.userId}`} className="inline-flex items-center gap-2.5 font-semibold text-[var(--foreground)] no-underline hover:underline">
                  <UserAvatar src={r.avatarUrl} name={r.displayName} size="sm" />
                  <span className="truncate">{r.displayName}</span>
                  {r.isViewer && <Pill className="h-6 px-2.5 text-[11px]">{t("you")}</Pill>}
                </Link>
              </td>
              <td className="px-3 py-3 text-right text-base font-bold tabular-nums text-[var(--foreground)]">{r.points}</td>
              {!compact && (
                <td className="hidden px-3 py-3 text-right tabular-nums text-[var(--foreground)]/55 sm:table-cell">
                  {r.wins}-{r.losses}-{r.draws}
                </td>
              )}
              <td className="px-3 py-3 text-right tabular-nums text-[var(--foreground)]/55">{r.events}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
