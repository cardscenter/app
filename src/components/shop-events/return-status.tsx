"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Hourglass } from "lucide-react";
import { toast } from "sonner";
import { refreshRegistrationStatus, payForRegistration } from "@/actions/shop-events";
import { DisplayHeading } from "@/components/ploy/display-heading";
import { CtaButton } from "@/components/ploy/cta-button";
import { PromptCard } from "@/components/ploy/prompt-card";
import { PunchCard } from "@/components/ploy/punch-card";
import { Balloon } from "@/components/ploy/balloon";

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
 * Design-pass: punch-card met display-kop en de ticketcode als donkere
 * kopieerkaart.
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

  const Card = ({ balloon, children }: { balloon: "green" | "yellow" | "pink"; children: React.ReactNode }) => (
    <PunchCard className="relative overflow-hidden bg-white px-6 py-12 text-center sm:px-12 sm:py-16" dot="var(--border)">
      <Balloon color={balloon} shape="cloud" className="pointer-events-none absolute -right-10 -top-10 w-40 opacity-90" />
      <div className="relative flex flex-col items-center gap-5">{children}</div>
    </PunchCard>
  );

  if (!state || ((state.status === "RESERVED" || state.status === "OFFERED") && attempts < 6 && state.paymentStatus !== "FAILED" && state.paymentStatus !== "CANCELED" && state.paymentStatus !== "EXPIRED")) {
    return (
      <Card balloon="yellow">
        <Hourglass className="size-10 animate-pulse text-[var(--primary)]" />
        <DisplayHeading tag="h1" size={3} text={t("returnChecking")} className="text-center" />
        <p className="cc-prose max-w-[28rem] text-base">{t("returnCheckingBody")}</p>
      </Card>
    );
  }

  if (state.status === "CONFIRMED" || state.status === "CHECKED_IN") {
    return (
      <Card balloon="green">
        <DisplayHeading tag="h1" size={2} text={t("returnSuccessTitle")} className="text-center" />
        <p className="cc-prose max-w-[28rem] text-base">{t("returnSuccessBody", { title: eventTitle })}</p>
        <PromptCard tone="dark" label={t("ticketCodeLabel")} value={state.ticketCode} copyLabel={t("copyCode")} copiedLabel={t("copiedCode")} className="w-full max-w-sm text-left">
          <code className="block text-center font-mono text-3xl font-semibold tracking-[0.08em]">{state.ticketCode}</code>
        </PromptCard>
        <CtaButton href={`/dashboard/tickets/${state.ticketCode}`} variant="red">
          {t("viewTicket")}
        </CtaButton>
      </Card>
    );
  }

  if (state.status === "RESERVED" || state.status === "OFFERED") {
    return (
      <Card balloon="yellow">
        <DisplayHeading tag="h1" size={2} text={t("returnNotPaidTitle")} className="text-center" />
        <p className="cc-prose max-w-[28rem] text-base">{t("returnNotPaidBody")}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <CtaButton onClick={retry} variant="red" className={pending ? "pointer-events-none opacity-60" : ""}>
            {t("payAgain")}
          </CtaButton>
          <CtaButton href={`/evenementen/${eventId}`} variant="light">
            {t("backToEvent")}
          </CtaButton>
        </div>
      </Card>
    );
  }

  return (
    <Card balloon="pink">
      <DisplayHeading tag="h1" size={2} text={t("returnFailedTitle")} className="text-center" />
      <p className="cc-prose max-w-[28rem] text-base">{state.status === "REFUNDED" ? t("returnRefundedBody") : t("returnFailedBody")}</p>
      <CtaButton href={`/evenementen/${eventId}`} variant="dark">
        {t("backToEvent")}
      </CtaButton>
    </Card>
  );
}
