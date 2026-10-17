import { Link } from "@/i18n/navigation";
import { CheckCircle2, AlertTriangle, Info, Gavel, Zap, Clock } from "lucide-react";
import { getReserveBreakdown } from "@/lib/balance-check";
import { ReserveSyncButton } from "@/components/admin/reserve-sync-button";
import { StatusBadge, type StatusTone } from "@/components/dashboard/ui/status-badge";
import { Callout } from "@/components/dashboard/ui/callout";
import { cn } from "@/lib/utils";

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
  { icon: typeof Gavel; label: string; explainer: string; tone: StatusTone }
> = {
  "highest-bidder": {
    icon: Gavel,
    label: "Hoogste bieder",
    explainer:
      "Staat momenteel bovenaan op deze veiling. Geld blijft vast tot de veiling eindigt of iemand overbiedt.",
    tone: "info",
  },
  "autobid-armed": {
    icon: Zap,
    label: "Autobid actief",
    explainer:
      "Is overboden, maar de automatische bieder kan elk moment terugkomen. Geld blijft vast totdat het maximum is bereikt of de veiling eindigt.",
    tone: "primary",
  },
  "awaiting-payment": {
    icon: Clock,
    label: "Wacht op betaling",
    explainer:
      "Heeft deze veiling gewonnen en moet nog betalen. Geld is gereserveerd tot betaling binnen is of de betaaltermijn verloopt.",
    tone: "warning",
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
    <div className="overflow-hidden dash-card">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <div>
          <h3 className="text-lg font-semibold tracking-[-0.03em] text-foreground">Vastgehouden bedrag: uitleg</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Waar het vastgehouden saldo van {userName} vandaan komt.
          </p>
        </div>
        {/* Sync-knop — alleen tonen als er drift is (anders verwarrend) */}
        {!inSync && <ReserveSyncButton userId={userId} />}
      </div>

      {/* Status-blok */}
      <div className="px-5 pt-4">
        {inSync ? (
          <Callout tone="green" icon={CheckCircle2} title="Klopt, geen actie nodig">
            De vastgehouden {formatEuro(dbReserved)} matcht precies met wat de actieve veilingen
            vasthouden. {hasReserves ? "Zodra die veilingen eindigen valt het geld vanzelf vrij." : "Er staan op dit moment geen biedingen open. Verwacht: €0,00."}
          </Callout>
        ) : (
          <Callout tone="yellow" icon={AlertTriangle} title="Saldo loopt uit de pas">
            In de database staat <strong>{formatEuro(dbReserved)}</strong> vast, maar volgens
            de werkelijke biedingen zou dat <strong>{formatEuro(liveReserved)}</strong> moeten
            zijn: een verschil van <strong>{formatEuro(Math.abs(drift))}</strong>{" "}
            {drift > 0 ? "te veel" : "te weinig"}. Druk op <em>Sync nu</em> om dit te
            corrigeren. Veilig: hierdoor wordt geen geld weggehaald, alleen de &quot;vast&quot;-teller
            herberekend.
          </Callout>
        )}
      </div>

      {/* Bedragen */}
      <div className="grid grid-cols-2 gap-3 px-5 pt-4 md:grid-cols-3">
        <div className="rounded-[12px] bg-[var(--background)] p-3">
          <p className="text-xs font-medium text-muted-foreground">In database</p>
          <p className="cc-display mt-1 text-2xl tabular-nums text-foreground">
            {formatEuro(dbReserved)}
          </p>
        </div>
        <div className="rounded-[12px] bg-[var(--background)] p-3">
          <p className="text-xs font-medium text-muted-foreground">Volgens biedingen</p>
          <p className="cc-display mt-1 text-2xl tabular-nums text-foreground">
            {formatEuro(liveReserved)}
          </p>
        </div>
        <div
          className={cn(
            "rounded-[12px] p-3",
            inSync
              ? "bg-[var(--pastel-green)] text-[var(--pastel-green-ink)]"
              : "bg-[var(--pastel-yellow)] text-[var(--pastel-yellow-ink)]",
          )}
        >
          <p className="text-xs font-medium opacity-80">Verschil</p>
          <p className="cc-display mt-1 text-2xl tabular-nums">
            {drift === 0 ? "€0,00" : `${drift > 0 ? "+" : ""}${formatEuro(drift).replace("€-", "−€")}`}
          </p>
        </div>
      </div>

      {/* Breakdown per veiling */}
      <div className="px-5 py-5">
        <h4 className="mb-2 text-sm font-semibold text-foreground">Per veiling</h4>
        {rows.length === 0 ? (
          <Callout tone="blue" icon={Info}>
            Geen actieve veilingen die geld vasthouden. Als de &quot;In database&quot;-waarde toch
            boven nul staat, druk dan op <em>Sync nu</em> om het terug te zetten naar €0,00.
          </Callout>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => {
              const meta = REASON_META[row.reason];
              const Icon = meta.icon;
              return (
                <li
                  key={row.auctionId}
                  className="rounded-[12px] bg-[var(--background)] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone={meta.tone} icon={Icon}>
                          {meta.label}
                        </StatusBadge>
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
                      <p className="text-xs font-medium text-muted-foreground">Vast</p>
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
            <li className="flex items-center justify-between rounded-[12px] bg-muted px-3 py-2 text-sm">
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
