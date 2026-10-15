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

  const statusPill = (() => {
    const base = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold";
    if (cancelledEvent) return <span className={`${base} bg-rose-500/10 text-rose-700 dark:text-rose-300`}><XCircle className="size-3" /> {t("statusEventCancelled")}</span>;
    switch (ticket.status) {
      case "CONFIRMED":
        return <span className={`${base} bg-emerald-500/10 text-emerald-700 dark:text-emerald-300`}><CheckCircle2 className="size-3" /> {t("statusConfirmed")}</span>;
      case "CHECKED_IN":
        return <span className={`${base} bg-emerald-500/10 text-emerald-700 dark:text-emerald-300`}><CheckCircle2 className="size-3" /> {t("statusCheckedIn")}</span>;
      case "RESERVED":
        return <span className={`${base} bg-amber-500/10 text-amber-700 dark:text-amber-300`}><Hourglass className="size-3" /> {t("statusReserved")}</span>;
      case "OFFERED":
        return <span className={`${base} bg-amber-500/10 text-amber-700 dark:text-amber-300`}><Hourglass className="size-3" /> {t("statusOffered")}</span>;
      case "WAITLIST":
        return <span className={`${base} bg-muted text-muted-foreground`}><Users className="size-3" /> {t("statusWaitlist")}</span>;
      case "NO_SHOW":
        return <span className={`${base} bg-muted text-muted-foreground`}>{t("statusNoShow")}</span>;
      case "CANCELLED":
        return <span className={`${base} bg-muted text-muted-foreground`}>{t("statusCancelled")}</span>;
      case "REFUNDED":
        return <span className={`${base} bg-muted text-muted-foreground`}>{t("statusRefunded")}</span>;
      default:
        return <span className={`${base} bg-muted text-muted-foreground`}>{ticket.status}</span>;
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
    <article className={`overflow-hidden rounded-2xl border border-border bg-card shadow-card ${variant === "full" ? "" : ""}`}>
      <div className={`grid ${variant === "full" ? "md:grid-cols-[320px_1fr]" : "sm:grid-cols-[140px_1fr]"}`}>
        <div className="flex items-center justify-center border-b border-dashed border-border bg-white p-4 md:border-b-0 md:border-r">
          {ticket.qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ticket.qrDataUrl} alt={t("qrAlt")} className={variant === "full" ? "size-64" : "size-28"} />
          ) : (
            <div className={`flex items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-500 ${variant === "full" ? "size-64" : "size-28"}`}>{t("noQr")}</div>
          )}
        </div>
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <EventTypePill name={ticket.event.typeName} color={ticket.event.typeColor} />
            {statusPill}
            {ticket.divisionLabel && <span className="text-xs text-muted-foreground">{ticket.divisionLabel}</span>}
          </div>
          <h3 className={`mt-2 font-semibold text-foreground ${variant === "full" ? "text-2xl" : "text-base"}`}>
            {variant === "full" ? ticket.event.title : <Link href={`/dashboard/tickets/${ticket.ticketCode}`} className="hover:text-primary">{ticket.event.title}</Link>}
          </h3>
          <p className="mt-1 font-mono text-sm font-semibold tracking-wider text-foreground">{ticket.ticketCode}</p>
          <div className="mt-3 space-y-1 text-sm text-muted-foreground">
            <p className="inline-flex items-center gap-1.5"><Clock className="size-3.5" /> {formatEventDate(start, locale)}, {formatEventTime(start, locale)} - {formatEventTime(end, locale)}</p>
            <br />
            <p className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" /> {shopAddress}</p>
          </div>
          {ticket.amount > 0 && <p className="mt-2 text-sm text-muted-foreground">{t("paidAmount", { amount: formatPrice(ticket.amount, locale) })}</p>}

          {(ticket.status === "RESERVED" || ticket.status === "OFFERED") && !cancelledEvent && (
            <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
              <p className="text-foreground">
                {ticket.status === "RESERVED"
                  ? t("reservedBody", { until: ticket.reservedUntil ? formatEventTime(new Date(ticket.reservedUntil), locale) : "" })
                  : t("offeredBody", { until: ticket.offerExpiresAt ? `${formatEventDateShort(new Date(ticket.offerExpiresAt), locale)} ${formatEventTime(new Date(ticket.offerExpiresAt), locale)}` : "" })}
              </p>
              <button type="button" onClick={pay} disabled={pending} className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
                {ticket.amount > 0 ? t("payNow", { price: formatPrice(ticket.amount, locale) }) : t("confirmSpot")}
              </button>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            {!cancelledEvent && (
              <a href={`/api/shop-events/${ticket.event.id}/ics`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                <CalendarPlus className="size-4" /> {t("addToCalendar")}
              </a>
            )}
            <Link href={`/evenementen/${ticket.event.id}`} className="text-muted-foreground hover:text-foreground">
              {t("eventPage")}
            </Link>
            {ticket.canCancel && !confirm && (
              <button type="button" onClick={() => setConfirm(true)} className="text-muted-foreground hover:text-foreground">
                {t("cancelRegistration")}
              </button>
            )}
          </div>
          {confirm && (
            <div className="mt-3 space-y-2 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm">
              <p>{ticket.amount > 0 ? (ticket.refundOnCancel ? t("cancelConfirmRefund", { hours: ticket.event.cancellationHours }) : t("cancelConfirmNoRefund")) : t("cancelConfirmFree")}</p>
              <div className="flex gap-2">
                <button type="button" onClick={cancel} disabled={pending} className="rounded-lg bg-rose-600 px-3 py-1.5 font-semibold text-white hover:bg-rose-700 disabled:opacity-60">{t("cancelYes")}</button>
                <button type="button" onClick={() => setConfirm(false)} className="rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground">{t("cancelNo")}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
