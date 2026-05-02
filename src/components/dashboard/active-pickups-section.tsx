import { Key, CalendarClock, MessageCircle, Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ExternalPickupConfirmButton } from "./external-pickup-confirm-button";
import { OpenPickupChatButton } from "./open-pickup-chat-button";

interface ActivePickup {
  id: string;
  orderNumber: string;
  counterpartyName: string;
  counterpartyId: string;
  pickupCode: string | null;
  proposedFor: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  paymentMode: string;
  scheduleStatus: string | null;
  conversationId: string | null;
  listingId: string | null;
  perspective: "buyer" | "seller";
}

interface Props {
  pickups: ActivePickup[];
}

// Sectie bovenaan /aankopen of /verkopen voor pickup-bundles. Toont twee
// soorten: SCHEDULED (afspraak vastgelegd, actie = bevestigen of code-tonen)
// en PENDING (nog geen afspraak, actie = chat openen + ophaalmoment voorstellen).
// Zorgt dat koper én verkoper niet hoeven te zoeken in z'n bestelling-lijst.
export async function ActivePickupsSection({ pickups }: Props) {
  if (pickups.length === 0) return null;

  const t = await getTranslations("pickup");

  const scheduled = pickups.filter((p) => p.scheduleStatus === "ACCEPTED");
  const pending = pickups.filter((p) => p.scheduleStatus !== "ACCEPTED");

  return (
    <section className="mb-6 space-y-4">
      {scheduled.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
            <CalendarClock className="h-5 w-5" />
            {t("upcomingPickups")}
          </h2>
          <div className="space-y-3">
            {scheduled.map((p) => {
              const date = p.proposedFor ? new Date(p.proposedFor) : null;
              const dateStr = date?.toLocaleDateString("nl-NL", {
                weekday: "long",
                day: "numeric",
                month: "long",
              });
              const isExternal = p.paymentMode === "EXTERNAL";
              const isBuyer = p.perspective === "buyer";
              return (
                <div
                  key={p.id}
                  className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {p.counterpartyName} • #{p.orderNumber}
                    </p>
                    {dateStr && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {dateStr} • {p.windowStart}–{p.windowEnd}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isExternal ? t("paymentModeExternal") : t("paymentModePlatform")}
                    </p>
                  </div>
                  <div className="flex flex-col items-stretch gap-2 sm:items-end">
                    {/* Buyer + EXTERNAL: confirm-knop. Buyer + PLATFORM: code.
                        Seller: alleen chat (code-confirm gebeurt in chat-bubble). */}
                    {isBuyer && isExternal ? (
                      <ExternalPickupConfirmButton shippingBundleId={p.id} />
                    ) : isBuyer && p.pickupCode ? (
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-blue-800 dark:text-blue-200">
                          <Key className="h-3.5 w-3.5" />
                          {t("codeForBuyer")}
                        </div>
                        <div className="font-mono text-2xl font-bold tracking-widest text-blue-900 dark:text-blue-100">
                          {p.pickupCode}
                        </div>
                      </div>
                    ) : null}
                    <OpenPickupChatButton
                      sellerId={p.perspective === "buyer" ? p.counterpartyId : ""}
                      buyerId={p.perspective === "seller" ? p.counterpartyId : ""}
                      listingId={p.listingId}
                      conversationId={p.conversationId}
                      perspective={p.perspective}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Clock className="h-5 w-5" />
            {t("pendingPickups")}
          </h2>
          <div className="space-y-3">
            {pending.map((p) => {
              const isExternal = p.paymentMode === "EXTERNAL";
              const isProposed = p.scheduleStatus === "PROPOSED";
              return (
                <div
                  key={p.id}
                  className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {p.counterpartyName} • #{p.orderNumber}
                    </p>
                    <p className="mt-1 text-xs text-amber-900 dark:text-amber-200">
                      {isProposed ? t("awaitingResponse") : t("noScheduleYet")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isExternal ? t("paymentModeExternal") : t("paymentModePlatform")}
                    </p>
                  </div>
                  <div className="flex flex-col items-stretch gap-2 sm:items-end">
                    <OpenPickupChatButton
                      sellerId={p.perspective === "buyer" ? p.counterpartyId : ""}
                      buyerId={p.perspective === "seller" ? p.counterpartyId : ""}
                      listingId={p.listingId}
                      conversationId={p.conversationId}
                      perspective={p.perspective}
                      label={t("scheduleInChat")}
                      icon={<MessageCircle className="h-4 w-4" />}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
