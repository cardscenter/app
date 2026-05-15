import { Link } from "@/i18n/navigation";
import { CheckCircle2, AlertTriangle, Info, Gavel, Zap, Clock } from "lucide-react";
import { getReserveBreakdown } from "@/lib/balance-check";
import { ReserveSyncButton } from "@/components/admin/reserve-sync-button";

// Server-component voor de admin user-detail page. Toont waar de
// `reservedBalance` van deze user vandaan komt en of de DB-waarde nog
// synchroon loopt met de werkelijke biedingen. Mikt op admins die geen
// idee hebben van escrow/reserve-mechanica — daarom korte uitleg-zinnen
// per rij ipv jargon.

interface Props {
  userId: string;
  userName: string;
}

const REASON_META: Record<
  "highest-bidder" | "autobid-armed" | "awaiting-payment",
  { icon: typeof Gavel; label: string; explainer: string; tone: string }
> = {
  "highest-bidder": {
    icon: Gavel,
    label: "Hoogste bieder",
    explainer:
      "Staat momenteel bovenaan op deze veiling. Geld blijft vast tot de veiling eindigt of iemand overbiedt.",
    tone: "text-sky-700 bg-sky-50 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30",
  },
  "autobid-armed": {
    icon: Zap,
    label: "Autobid actief",
    explainer:
      "Is overboden, maar de automatische bieder kan elk moment terugkomen. Geld blijft vast totdat het maximum is bereikt of de veiling eindigt.",
    tone: "text-violet-700 bg-violet-50 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30",
  },
  "awaiting-payment": {
    icon: Clock,
    label: "Wacht op betaling",
    explainer:
      "Heeft deze veiling gewonnen en moet nog betalen. Geld is gereserveerd tot betaling binnen is of de betaaltermijn verloopt.",
    tone: "text-amber-700 bg-amber-50 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
  },
};

function formatEuro(n: number): string {
  return `€${n.toFixed(2).replace(".", ",")}`;
}

export async function ReserveBreakdownCard({ userId, userName }: Props) {
  const { dbReserved, liveReserved, drift, rows } = await getReserveBreakdown(userId);

  const inSync = Math.abs(drift) < 0.01;
  const hasReserves = liveReserved > 0;

  return (
    <div className="rounded-2xl border border-border bg-card">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Vastgehouden bedrag — uitleg</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Waar het vastgehouden saldo van {userName} vandaan komt.
          </p>
        </div>
        {/* Sync-knop — alleen tonen als er drift is (anders verwarrend) */}
        {!inSync && <ReserveSyncButton userId={userId} />}
      </div>

      {/* Status-blok */}
      <div className="px-4 pt-4">
        {inSync ? (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-300/50 bg-emerald-50 p-3 dark:border-emerald-800/50 dark:bg-emerald-950/30">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="text-sm">
              <p className="font-semibold text-emerald-800 dark:text-emerald-200">
                Klopt — geen actie nodig
              </p>
              <p className="mt-0.5 text-emerald-700 dark:text-emerald-300">
                De vastgehouden {formatEuro(dbReserved)} matcht precies met wat de actieve veilingen
                vasthouden. {hasReserves ? "Zodra die veilingen eindigen valt het geld vanzelf vrij." : "Er staan op dit moment geen biedingen open — verwacht: €0,00."}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="text-sm">
              <p className="font-semibold text-amber-800 dark:text-amber-200">
                Saldo loopt uit de pas
              </p>
              <p className="mt-0.5 text-amber-700 dark:text-amber-300">
                In de database staat <strong>{formatEuro(dbReserved)}</strong> vast, maar volgens
                de werkelijke biedingen zou dat <strong>{formatEuro(liveReserved)}</strong> moeten
                zijn — een verschil van <strong>{formatEuro(Math.abs(drift))}</strong>{" "}
                {drift > 0 ? "te veel" : "te weinig"}. Druk op <em>Sync nu</em> om dit te
                corrigeren. Veilig: hierdoor wordt geen geld weggehaald, alleen de "vast"-teller
                herberekend.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bedragen */}
      <div className="grid grid-cols-2 gap-3 px-4 pt-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-muted p-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
            In database
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
            {formatEuro(dbReserved)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted p-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
            Volgens biedingen
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
            {formatEuro(liveReserved)}
          </p>
        </div>
        <div
          className={`rounded-lg border p-3 ${
            inSync
              ? "border-emerald-300/50 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/30"
              : "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
          }`}
        >
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
            Verschil
          </p>
          <p
            className={`mt-1 text-lg font-bold tabular-nums ${
              inSync ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"
            }`}
          >
            {drift === 0 ? "€0,00" : `${drift > 0 ? "+" : ""}${formatEuro(drift).replace("€-", "−€")}`}
          </p>
        </div>
      </div>

      {/* Breakdown per veiling */}
      <div className="px-4 py-4">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          Per veiling
        </h4>
        {rows.length === 0 ? (
          <div className="flex items-start gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Geen actieve veilingen die geld vasthouden. Als de "In database"-waarde toch
              boven nul staat, druk dan op <em>Sync nu</em> om het terug te zetten naar €0,00.
            </span>
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => {
              const meta = REASON_META[row.reason];
              const Icon = meta.icon;
              return (
                <li
                  key={row.auctionId}
                  className="rounded-xl border border-border bg-card/60 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${meta.tone}`}
                        >
                          <Icon className="h-3 w-3" />
                          {meta.label}
                        </span>
                        <Link
                          href={`/veilingen/${row.auctionId}`}
                          className="truncate text-sm font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {row.title}
                        </Link>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{meta.explainer}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
                        Vast
                      </p>
                      <p className="text-base font-bold tabular-nums text-foreground">
                        {formatEuro(row.reserveAmount)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                        10% van {formatEuro(row.baseAmount)} × 1,029
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
            <li className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2 text-sm">
              <span className="font-semibold text-foreground">Totaal volgens biedingen</span>
              <span className="text-base font-bold tabular-nums text-foreground">
                {formatEuro(liveReserved)}
              </span>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}
