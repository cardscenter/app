import { Key, CalendarClock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ExternalPickupConfirmButton } from "./external-pickup-confirm-button";

interface ActivePickup {
  id: string;
  orderNumber: string;
  sellerName: string;
  pickupCode: string | null;
  proposedFor: string; // ISO date
  windowStart: string;
  windowEnd: string;
  paymentMode: string; // PLATFORM | EXTERNAL
}

interface Props {
  pickups: ActivePickup[];
}

// Sectie bovenaan /aankopen voor SCHEDULED pickup-bundles van de buyer.
// PLATFORM: prominent code-blok zodat koper bij de deur niet hoeft te zoeken.
// EXTERNAL: confirm-knop (geen code — koper bevestigt 1-klik na ophaal).
// Beide tonen datum + tijdvenster + payment-mode hint.
export async function ActivePickupsSection({ pickups }: Props) {
  if (pickups.length === 0) return null;

  const t = await getTranslations("pickup");

  return (
    <section className="mb-6">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
        <CalendarClock className="h-5 w-5" />
        {t("upcomingPickups")}
      </h2>
      <div className="space-y-3">
        {pickups.map((p) => {
          const date = new Date(p.proposedFor);
          const dateStr = date.toLocaleDateString("nl-NL", {
            weekday: "long",
            day: "numeric",
            month: "long",
          });
          const isExternal = p.paymentMode === "EXTERNAL";
          return (
            <div
              key={p.id}
              className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {p.sellerName} • #{p.orderNumber}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {dateStr} • {p.windowStart}–{p.windowEnd}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isExternal ? t("paymentModeExternal") : t("paymentModePlatform")}
                </p>
              </div>
              <div className="flex flex-col items-start gap-1 sm:items-end">
                {/* PLATFORM: code prominent voor seller. EXTERNAL: koper-confirm. */}
                {isExternal ? (
                  <ExternalPickupConfirmButton shippingBundleId={p.id} />
                ) : p.pickupCode ? (
                  <>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-blue-800 dark:text-blue-200">
                      <Key className="h-3.5 w-3.5" />
                      {t("codeForBuyer")}
                    </div>
                    <div className="font-mono text-2xl font-bold tracking-widest text-blue-900 dark:text-blue-100">
                      {p.pickupCode}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
