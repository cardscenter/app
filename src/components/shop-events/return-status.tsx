"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { CheckCircle2, Hourglass, XCircle, Ticket, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { refreshRegistrationStatus, payForRegistration } from "@/actions/shop-events";

interface Props {
  registrationId: string;
  eventId: string;
  eventTitle: string;
  locale: string;
}

/**
 * Na terugkeer van de checkout: status ophalen (synct bij Mollie), daarna
 * nog een paar keer pollen zolang de betaling "open/pending" is (iDEAL kan
 * een paar seconden nalopen). Daarna: ticket, opnieuw betalen, of mislukt.
 */
export function ReturnStatus({ registrationId, eventId, eventTitle, locale }: Props) {
  const t = useTranslations("shopEvents");
  const router = useRouter();
  const [state, setState] = useState<{ status: string; ticketCode: string; paymentStatus: string | null } | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const r = await refreshRegistrationStatus(registrationId);
      if (cancelled || "error" in r) return;
      setState({ status: r.status, ticketCode: r.ticketCode, paymentStatus: r.paymentStatus });
      const settled = r.status === "CONFIRMED" || r.status === "CHECKED_IN" || r.status === "EXPIRED" || r.status === "REFUNDED" || r.status === "CANCELLED";
      if (!settled && attempts < 6) setTimeout(() => !cancelled && setAttempts((a) => a + 1), 2500);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [registrationId, attempts]);

  function retry() {
    startTransition(async () => {
      const r = await payForRegistration(registrationId, locale);
      if ("error" in r) {
        toast.error(r.error);
        router.push(`/evenementen/${eventId}`);
        return;
      }
      if (r.kind === "payment") window.location.href = r.checkoutUrl.startsWith("http") ? r.checkoutUrl : `/${locale}${r.checkoutUrl.replace(/^\/(nl|en)/, "")}`;
      else router.push(`/dashboard/tickets/${r.ticketCode}`);
    });
  }

  const card = "rounded-2xl border border-border bg-card p-8 text-center shadow-card";

  if (!state || ((state.status === "RESERVED" || state.status === "OFFERED") && attempts < 6 && state.paymentStatus !== "FAILED" && state.paymentStatus !== "CANCELED" && state.paymentStatus !== "EXPIRED")) {
    return (
      <div className={card}>
        <Hourglass className="mx-auto size-10 animate-pulse text-primary" />
        <h1 className="mt-4 text-xl font-semibold text-foreground">{t("returnChecking")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("returnCheckingBody")}</p>
      </div>
    );
  }

  if (state.status === "CONFIRMED" || state.status === "CHECKED_IN") {
    return (
      <div className={card}>
        <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
        <h1 className="mt-4 text-2xl font-bold text-foreground">{t("returnSuccessTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("returnSuccessBody", { title: eventTitle })}</p>
        <p className="mt-3 font-mono text-lg font-semibold text-foreground">{state.ticketCode}</p>
        <Link href={`/dashboard/tickets/${state.ticketCode}`} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
          <Ticket className="size-4" /> {t("viewTicket")}
        </Link>
      </div>
    );
  }

  if (state.status === "RESERVED" || state.status === "OFFERED") {
    return (
      <div className={card}>
        <XCircle className="mx-auto size-12 text-amber-600" />
        <h1 className="mt-4 text-2xl font-bold text-foreground">{t("returnNotPaidTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("returnNotPaidBody")}</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <button type="button" onClick={retry} disabled={pending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
            <RefreshCw className="size-4" /> {t("payAgain")}
          </button>
          <Link href={`/evenementen/${eventId}`} className="inline-flex items-center justify-center rounded-xl border border-border px-6 py-3 text-sm font-medium hover:bg-muted">
            {t("backToEvent")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={card}>
      <XCircle className="mx-auto size-12 text-rose-600" />
      <h1 className="mt-4 text-2xl font-bold text-foreground">{t("returnFailedTitle")}</h1>
      <p className="mt-2 text-muted-foreground">{state.status === "REFUNDED" ? t("returnRefundedBody") : t("returnFailedBody")}</p>
      <Link href={`/evenementen/${eventId}`} className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
        {t("backToEvent")}
      </Link>
    </div>
  );
}
