"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { CalendarPlus, MapPin, Clock, CheckCircle2, Hourglass, Users, XCircle } from "lucide-react";
import type { TicketView } from "@/lib/shop-events/queries";
import { cancelMyRegistration, payForRegistration } from "@/actions/shop-events";
import { formatEventDate, formatEventTime, formatPrice, formatEventDateShort } from "@/lib/shop-events/format";
import { EventTypePill } from "./event-type-pill";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import { Callout } from "@/components/dashboard/ui/callout";
import { PILL_BTN_SM, PILL_RED_SM } from "@/components/ploy/tile-styles";
import { cn } from "@/lib/utils";

/**
 * Ticket-kaart: QR groot (alleen bij geldig ticket), code, event-gegevens,
 * agenda-link en annuleren. `variant="compact"` voor de lijst, "full" voor
 * de detailpagina.
 */
export function TicketCard({ ticket, locale, variant = "compact", shopAddress }: { ticket: TicketView; locale: string; variant?: "compact" | "full"; shopAddress: string }) {
  const t = useTranslations("shopEvents");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const start = new Date(ticket.event.startsAt);
  const end = new Date(ticket.event.endsAt);
  const cancelledEvent = ticket.event.status === "CANCELLED";
  const full = variant === "full";

  const statusPill = (() => {
    if (cancelledEvent) return <StatusBadge tone="danger" icon={XCircle}>{t("statusEventCancelled")}</StatusBadge>;
    switch (ticket.status) {
      case "CONFIRMED":
        return <StatusBadge tone="success" icon={CheckCircle2}>{t("statusConfirmed")}</StatusBadge>;
      case "CHECKED_IN":
        return <StatusBadge tone="success" icon={CheckCircle2}>{t("statusCheckedIn")}</StatusBadge>;
      case "RESERVED":
        return <StatusBadge tone="warning" icon={Hourglass}>{t("statusReserved")}</StatusBadge>;
      case "OFFERED":
        return <StatusBadge tone="warning" icon={Hourglass}>{t("statusOffered")}</StatusBadge>;
      case "WAITLIST":
        return <StatusBadge tone="neutral" icon={Users}>{t("statusWaitlist")}</StatusBadge>;
      case "NO_SHOW":
        return <StatusBadge tone="neutral">{t("statusNoShow")}</StatusBadge>;
      case "CANCELLED":
        return <StatusBadge tone="neutral">{t("statusCancelled")}</StatusBadge>;
      case "REFUNDED":
        return <StatusBadge tone="neutral">{t("statusRefunded")}</StatusBadge>;
      default:
        return <StatusBadge tone="neutral">{ticket.status}</StatusBadge>;
    }
  })();

  function pay() {
    startTransition(async () => {
      const r = await payForRegistration(ticket.id, locale);
      if ("error" in r) {
        toast.error(r.error);
        router.refresh();
        return;
      }
      if (r.kind === "payment") window.location.href = r.checkoutUrl.startsWith("http") ? r.checkoutUrl : `/${locale}${r.checkoutUrl.replace(/^\/(nl|en)/, "")}`;
      else router.refresh();
    });
  }

  function cancel() {
    startTransition(async () => {
      const r = await cancelMyRegistration(ticket.id);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(r.refunded ? t("toastCancelledRefund") : t("toastCancelled"));
      setConfirm(false);
      router.refresh();
    });
  }

  return (
    <article className="dash-card overflow-hidden">
      <div className={cn("grid", full ? "md:grid-cols-[320px_1fr]" : "sm:grid-cols-[160px_1fr]")}>
        <div
          className={cn(
            "flex items-center justify-center border-b border-dashed border-border bg-white p-4",
            full ? "md:border-b-0 md:border-r" : "sm:border-b-0 sm:border-r",
          )}
        >
          {ticket.qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ticket.qrDataUrl} alt={t("qrAlt")} className={full ? "size-64" : "size-28"} />
          ) : (
            <div className={cn("flex items-center justify-center rounded-[12px] bg-muted px-3 text-center text-xs text-muted-foreground", full ? "size-64" : "size-28")}>
              {t("noQr")}
            </div>
          )}
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <EventTypePill name={ticket.event.typeName} color={ticket.event.typeColor} />
            {statusPill}
            {ticket.divisionLabel && <span className="text-xs text-muted-foreground">{ticket.divisionLabel}</span>}
          </div>
          <h3 className={cn("mt-3 font-semibold tracking-[-0.03em] text-foreground", full ? "text-2xl" : "text-lg")}>
            {full ? (
              ticket.event.title
            ) : (
              <Link href={`/dashboard/tickets/${ticket.ticketCode}`} className="hover:text-primary">
                {ticket.event.title}
              </Link>
            )}
          </h3>
          <p className="mt-1 font-mono text-sm font-semibold tracking-wider text-foreground">{ticket.ticketCode}</p>
          <div className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground">
            <p className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5 shrink-0" /> {formatEventDate(start, locale)}, {formatEventTime(start, locale)} - {formatEventTime(end, locale)}
            </p>
            <p className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" /> {shopAddress}
            </p>
          </div>
          {ticket.amount > 0 && <p className="mt-2 text-sm text-muted-foreground">{t("paidAmount", { amount: formatPrice(ticket.amount, locale) })}</p>}

          {(ticket.status === "RESERVED" || ticket.status === "OFFERED") && !cancelledEvent && (
            <Callout
              tone="yellow"
              icon={Hourglass}
              className="mt-4"
              action={
                <button type="button" onClick={pay} disabled={pending} className={cn(PILL_RED_SM, "disabled:opacity-60")}>
                  {ticket.amount > 0 ? t("payNow", { price: formatPrice(ticket.amount, locale) }) : t("confirmSpot")}
                </button>
              }
            >
              {ticket.status === "RESERVED"
                ? t("reservedBody", { until: ticket.reservedUntil ? formatEventTime(new Date(ticket.reservedUntil), locale) : "" })
                : t("offeredBody", {
                    until: ticket.offerExpiresAt ? `${formatEventDateShort(new Date(ticket.offerExpiresAt), locale)} ${formatEventTime(new Date(ticket.offerExpiresAt), locale)}` : "",
                  })}
            </Callout>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!cancelledEvent && (
              <a href={`/api/shop-events/${ticket.event.id}/ics`} className={PILL_BTN_SM}>
                <CalendarPlus className="size-3.5" /> {t("addToCalendar")}
              </a>
            )}
            <Link href={`/evenementen/${ticket.event.id}`} className={PILL_BTN_SM}>
              {t("eventPage")}
            </Link>
            {ticket.canCancel && !confirm && (
              <button type="button" onClick={() => setConfirm(true)} className="px-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
                {t("cancelRegistration")}
              </button>
            )}
          </div>
          {confirm && (
            <Callout tone="pink" icon={XCircle} className="mt-3">
              <p>
                {ticket.amount > 0
                  ? ticket.refundOnCancel
                    ? t("cancelConfirmRefund", { hours: ticket.event.cancellationHours })
                    : t("cancelConfirmNoRefund")
                  : t("cancelConfirmFree")}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button type="button" onClick={cancel} disabled={pending} className="cc-pill inline-flex items-center justify-center bg-[var(--destructive)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--destructive)]/90 disabled:opacity-60">
                  {t("cancelYes")}
                </button>
                <button type="button" onClick={() => setConfirm(false)} className={PILL_BTN_SM}>
                  {t("cancelNo")}
                </button>
              </div>
            </Callout>
          )}
        </div>
      </div>
    </article>
  );
}
