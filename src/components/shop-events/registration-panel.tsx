"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { toast } from "sonner";
import { Ticket, Clock, Users, AlertTriangle, CheckCircle2, Hourglass } from "lucide-react";
import { registerForShopEvent, payForRegistration, cancelMyRegistration } from "@/actions/shop-events";
import type { ShopEventDetail } from "@/lib/shop-events/queries";
import { formatPrice, formatEventDateShort, formatEventTime } from "@/lib/shop-events/format";

interface Props {
  event: ShopEventDetail;
  locale: string;
  viewer: { loggedIn: boolean; needsSupervision: boolean; eligibility: { ok: boolean; reason?: string } };
}

/**
 * Inschrijfpaneel op de event-detailpagina: toont de juiste staat
 * (inschrijven, betalen, wachtlijst, ticket, annuleren) en start de flows.
 */
export function RegistrationPanel({ event, locale, viewer }: Props) {
  const t = useTranslations("shopEvents");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [supervised, setSupervised] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const a = event.availability;
  const mine = event.mine;
  const price = formatPrice(event.price, locale);

  function go(href: string) {
    if (href.startsWith("http")) window.location.href = href;
    else router.push(href);
  }

  function register(joinWaitlist: boolean) {
    startTransition(async () => {
      const r = await registerForShopEvent(event.id, { supervisedByAdult: supervised, joinWaitlist, locale });
      if ("error" in r) {
        toast.error(r.error);
        if (r.reason === "dob" || r.reason === "guardian" || r.reason === "email") router.push("/dashboard/profiel");
        return;
      }
      if (r.kind === "confirmed") {
        toast.success(t("toastConfirmed"));
        router.push(`/dashboard/tickets/${r.ticketCode}`);
      } else if (r.kind === "payment") {
        go(r.checkoutUrl);
      } else if (r.kind === "waitlist") {
        toast.success(t("toastWaitlist", { position: r.position }));
        router.refresh();
      } else if (r.kind === "full") {
        toast.error(r.waitlistAvailable ? t("fullJoinWaitlistHint") : t("full"));
        router.refresh();
      }
    });
  }

  function pay() {
    if (!mine) return;
    startTransition(async () => {
      const r = await payForRegistration(mine.id, locale);
      if ("error" in r) {
        toast.error(r.error);
        router.refresh();
        return;
      }
      if (r.kind === "payment") go(r.checkoutUrl);
      else {
        toast.success(t("toastConfirmed"));
        router.push(`/dashboard/tickets/${r.ticketCode}`);
      }
    });
  }

  function cancel() {
    if (!mine) return;
    startTransition(async () => {
      const r = await cancelMyRegistration(mine.id);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(r.refunded ? t("toastCancelledRefund") : t("toastCancelled"));
      setConfirmCancel(false);
      router.refresh();
    });
  }

  const Box = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">{children}</div>
  );
  const Primary = ({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={pending || disabled}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary-hover disabled:opacity-60"
    >
      {children}
    </button>
  );
  const Secondary = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
    >
      {children}
    </button>
  );

  const cancelBlock = mine?.canCancel ? (
    <div className="mt-4 border-t border-border pt-4">
      {!confirmCancel ? (
        <button type="button" onClick={() => setConfirmCancel(true)} className="text-sm text-muted-foreground underline-offset-2 hover:underline">
          {t("cancelRegistration")}
        </button>
      ) : (
        <div className="space-y-2 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3">
          <p className="text-sm text-foreground">
            {mine.amount > 0 ? (mine.refundOnCancel ? t("cancelConfirmRefund", { hours: event.cancellationHours }) : t("cancelConfirmNoRefund")) : t("cancelConfirmFree")}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={cancel} disabled={pending} className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
              {t("cancelYes")}
            </button>
            <button type="button" onClick={() => setConfirmCancel(false)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
              {t("cancelNo")}
            </button>
          </div>
        </div>
      )}
    </div>
  ) : null;

  // ---- Bestaande inschrijving
  if (mine) {
    if (mine.status === "CONFIRMED" || mine.status === "CHECKED_IN") {
      return (
        <Box>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
            <div>
              <h3 className="font-semibold text-foreground">{mine.status === "CHECKED_IN" ? t("youAreCheckedIn") : t("youAreRegistered")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("ticketCodeLabel")} <span className="font-mono font-semibold text-foreground">{mine.ticketCode}</span>
                {mine.divisionLabel && <> · {mine.divisionLabel}</>}
              </p>
            </div>
          </div>
          <Link href={`/dashboard/tickets/${mine.ticketCode}`} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
            <Ticket className="size-4" /> {t("viewTicket")}
          </Link>
          {cancelBlock}
        </Box>
      );
    }
    if (mine.status === "RESERVED") {
      return (
        <Box>
          <div className="flex items-start gap-3">
            <Hourglass className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div>
              <h3 className="font-semibold text-foreground">{t("reservedTitle")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("reservedBody", { until: mine.reservedUntil ? formatEventTime(new Date(mine.reservedUntil), locale) : "" })}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Primary onClick={pay}>{t("payNow", { price })}</Primary>
          </div>
          {cancelBlock}
        </Box>
      );
    }
    if (mine.status === "OFFERED") {
      return (
        <Box>
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div>
              <h3 className="font-semibold text-foreground">{t("offeredTitle")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("offeredBody", {
                  until: mine.offerExpiresAt ? `${formatEventDateShort(new Date(mine.offerExpiresAt), locale)} ${formatEventTime(new Date(mine.offerExpiresAt), locale)}` : "",
                })}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Primary onClick={pay}>{event.price > 0 ? t("payNow", { price }) : t("confirmSpot")}</Primary>
          </div>
          {cancelBlock}
        </Box>
      );
    }
    if (mine.status === "WAITLIST") {
      return (
        <Box>
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <h3 className="font-semibold text-foreground">{t("onWaitlistTitle")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("onWaitlistBody", { position: mine.waitlistPosition ?? 1 })}</p>
            </div>
          </div>
          {cancelBlock}
        </Box>
      );
    }
  }

  // ---- Nog niet ingeschreven
  if (event.window !== "open") {
    const msg =
      event.window === "not-yet"
        ? t("windowNotYet", { date: event.registrationOpensAt ? formatEventDateShort(new Date(event.registrationOpensAt), locale) : "" })
        : event.window === "closed"
          ? t("windowClosed")
          : event.window === "started"
            ? t("windowStarted")
            : event.status === "CANCELLED"
              ? t("windowCancelled")
              : t("windowUnavailable");
    return (
      <Box>
        <p className="text-sm text-muted-foreground">{msg}</p>
      </Box>
    );
  }

  if (!viewer.loggedIn) {
    return (
      <Box>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold text-foreground">{price}</span>
          <span className="text-sm text-muted-foreground">{spotsLabel(t, a)}</span>
        </div>
        <Link href={`/login?callbackUrl=/evenementen/${event.id}`} className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
          {t("loginToRegister")}
        </Link>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {t("noAccountYet")}{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            {t("registerAccount")}
          </Link>
        </p>
      </Box>
    );
  }

  if (!viewer.eligibility.ok) {
    return (
      <Box>
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <h3 className="font-semibold text-foreground">{t("notEligibleTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{viewer.eligibility.reason}</p>
          </div>
        </div>
        <Link href="/dashboard/profiel" className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted">
          {t("goToProfile")}
        </Link>
      </Box>
    );
  }

  return (
    <Box>
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-bold text-foreground">{price}</span>
        <span className={`text-sm ${a.full ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>{spotsLabel(t, a)}</span>
      </div>
      {viewer.needsSupervision && event.underTwelveWithAdult && (
        <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-muted/40 p-3 text-sm">
          <input type="checkbox" checked={supervised} onChange={(e) => setSupervised(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
          <span className="text-foreground">{t("supervisionCheckbox")}</span>
        </label>
      )}
      <div className="mt-4 space-y-2">
        {a.full ? (
          event.waitlistEnabled ? (
            <>
              <Primary onClick={() => register(true)}>
                <Users className="size-4" /> {t("joinWaitlist")}
              </Primary>
              <p className="text-center text-xs text-muted-foreground">{t("waitlistExplain")}</p>
            </>
          ) : (
            <p className="text-center text-sm font-medium text-amber-600 dark:text-amber-400">{t("full")}</p>
          )
        ) : (
          <>
            <Primary onClick={() => register(false)} disabled={viewer.needsSupervision && event.underTwelveWithAdult && !supervised}>
              <Ticket className="size-4" /> {event.price > 0 ? t("registerAndPay", { price }) : t("registerFree")}
            </Primary>
            {event.price > 0 && (
              <p className="inline-flex w-full items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                <Clock className="size-3" /> {t("reservationHint")}
              </p>
            )}
          </>
        )}
      </div>
      {a.full && !event.waitlistEnabled ? null : <Secondary onClick={() => router.push("/dashboard/tickets")}>{t("myTickets")}</Secondary>}
    </Box>
  );
}

function spotsLabel(t: ReturnType<typeof useTranslations<"shopEvents">>, a: ShopEventDetail["availability"]): string {
  if (a.spotsLeft === null) return t("spotsUnlimited");
  if (a.full) return a.waitlistCount > 0 ? t("fullWithWaitlist", { count: a.waitlistCount }) : t("full");
  return t("spotsLeft", { count: a.spotsLeft });
}
