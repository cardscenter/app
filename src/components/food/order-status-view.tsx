"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Check, Info, Bell, Table2, Utensils, Clock } from "lucide-react";
import { getFoodOrderStatus, retryFoodPayment } from "@/actions/food-orders";
import type { OrderView } from "@/lib/food/orders";
import { WAIT_DEFAULT } from "@/lib/food/menu-data";
import { formatEuro } from "@/lib/food/pricing";
import type { MenuData } from "./food-types";
import { Btn, TopBar } from "./food-ui";

interface Props {
  locale: string;
  orderId: string;
  token: string;
  initial: OrderView | null;
  menu: MenuData;
}

/**
 * Bevestiging + live status (prototype `vDone`): bestelnummer, aftelbalk,
 * stepper (met extra stap "Nog te betalen" bij barbetaling), status-regels.
 * Pollt elke 5 seconden; na "afgerond" stopt het pollen.
 */
export function OrderStatusView({ locale, orderId, token, initial, menu }: Props) {
  const t = useTranslations("food");
  const router = useRouter();
  const [order, setOrder] = useState<OrderView | null>(initial);
  const [missing, setMissing] = useState(!initial);
  const [tick, setTick] = useState(0);
  const [pending, startTransition] = useTransition();
  const lang = locale === "en" ? "en" : "nl";
  const fmt = (n: number) => formatEuro(n, lang);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const o = await getFoodOrderStatus(orderId, token);
      if (!active) return;
      if (!o) setMissing(true);
      else setOrder(o);
    };
    if (!initial) void load();
    const id = setInterval(() => {
      if (order && order.status === "DONE") return;
      void load();
    }, 5000);
    const clock = setInterval(() => setTick((x) => x + 1), 15000);
    return () => {
      active = false;
      clearInterval(id);
      clearInterval(clock);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, token]);

  function retry() {
    startTransition(async () => {
      const r = await retryFoodPayment(orderId, token, lang);
      if ("error" in r) {
        setOrder((o) => o);
        alert(r.error);
        return;
      }
      window.location.href = r.checkoutUrl.startsWith("http") ? r.checkoutUrl : r.checkoutUrl;
    });
  }

  const changeLang = (l: "nl" | "en") => router.replace({ pathname: `/bestellen/status/${orderId}`, query: { t: token } }, { locale: l });

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-white">
      <TopBar onBack={null} lang={lang} onLang={changeLang} />
      <div className="mx-auto max-w-[440px] px-4 pb-10 pt-6 sm:max-w-[620px]">{children}</div>
    </div>
  );

  if (missing || !order) {
    return shell(
      <div className="rounded-2xl border border-[var(--line)] p-6 text-center">
        <p className="text-sm text-[var(--ink-2)]">{missing ? t("orderNotFound") : t("awaitingBody")}</p>
        <div className="mt-4"><Btn variant="ghost" onClick={() => router.push("/bestellen")}>{t("backMenu")}</Btn></div>
      </div>,
    );
  }

  const tb = order.mode === "TABLE";
  const bar = order.payment === "BAR";
  const unpaid = bar && !order.paid;

  // Online, nog niet betaald: wachten op de bank / opnieuw betalen.
  if (order.status === "AWAITING_PAYMENT" || order.status === "PAYMENT_FAILED") {
    const failed = order.status === "PAYMENT_FAILED" || order.paymentStatus === "FAILED" || order.paymentStatus === "CANCELED" || order.paymentStatus === "EXPIRED";
    const expired = Date.now() - new Date(order.createdAt).getTime() > 30 * 60_000;
    return shell(
      <div className="text-center">
        <div className={`mx-auto flex size-16 items-center justify-center rounded-full ${failed ? "bg-[var(--red-soft)] text-[var(--red-dark)]" : "bg-[var(--amber-soft)] text-[var(--amber)]"}`}>
          {failed ? <Info className="size-8" /> : <Clock className="size-8 pulse" />}
        </div>
        <h1 className="mt-4 text-2xl font-bold">{failed ? t("payFailedTitle") : t("awaitingTitle")}</h1>
        <p className="mt-2 text-[var(--ink-2)]">{expired ? t("payExpired") : failed ? t("payFailedBody") : t("awaitingBody")}</p>
        <div className="mt-6 space-y-2">
          {!expired && <Btn onClick={retry} disabled={pending}>{t("payRetry")}</Btn>}
          <Btn variant="ghost" onClick={() => router.push("/bestellen")}>{t("newOrder")}</Btn>
        </div>
      </div>,
    );
  }

  const stepsArr = [...(bar ? [order.paid ? t("stPaid") : t("stPay")] : []), t("st1"), t("st2"), t(tb ? "st3T" : "st3B")];
  const statusIdx = { NEW: 0, PREPARING: 1, READY: 2, DONE: 3 }[order.status as "NEW" | "PREPARING" | "READY" | "DONE"] ?? 0;
  const idx = unpaid ? 0 : (bar ? 1 : 0) + statusIdx;
  const finished = order.status === "DONE";
  void tick;

  return shell(
    <div>
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[var(--green-soft)] text-[var(--green)]">
        <Check className="size-8" strokeWidth={3} />
      </div>
      <h1 className="mt-4 text-center text-2xl font-bold leading-tight">{finished ? t(tb ? "stDoneT" : "stDoneB") : unpaid ? t("doneTitleBar") : t("doneTitle")}</h1>

      <div className="mx-auto mt-5 w-fit rounded-2xl border-2 border-dashed border-[var(--line)] px-8 py-3 text-center">
        <small className="block text-[11px] font-bold uppercase tracking-[.12em] text-[var(--ink-3)]">{t("orderNo")}</small>
        <b className="display block text-4xl font-extrabold tabular-nums">{order.number}</b>
      </div>

      <EtaBar order={order} t={t} />

      <div className="mt-6 grid gap-1" style={{ gridTemplateColumns: `repeat(${stepsArr.length}, minmax(0, 1fr))` }} aria-label="Status">
        {stepsArr.map((s, i) => {
          const on = i <= idx;
          const now = i === idx && !finished;
          return (
            <div key={s} className="flex flex-col items-center gap-1.5 text-center">
              <i className={`block h-1.5 w-full rounded-full ${on ? "bg-[var(--green)]" : "bg-[var(--line)]"} ${now ? "pulse" : ""}`} />
              <span className={`text-[11px] font-semibold leading-tight ${on ? "text-[var(--ink)]" : "text-[var(--ink-3)]"}`}>{s}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-6 space-y-2 text-sm">
        <Row icon={tb ? <Table2 className="size-4" /> : <Bell className="size-4" />}>{tb ? t("doneT", { n: order.table ?? 0 }) : t("doneB", { name: order.name ?? "" })}</Row>
        {bar ? (
          order.paid ? <Row icon={<Check className="size-4" />}>{t("paidAtBarOk")}</Row> : <Row icon={<Info className="size-4" />} tone="alert">{t("payAtBarAlert", { no: order.number })}</Row>
        ) : (
          <Row icon={<Check className="size-4" />}>{t("paidWith", { m: order.method ?? "", amt: fmt(order.total + order.tip) })}</Row>
        )}
        {tb && <Row icon={<Utensils className="size-4" />}>{t("clearNote")}</Row>}
      </div>

      <details className="mt-5 rounded-xl border border-[var(--line)]">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">{t("payLines")}</summary>
        <ul className="divide-y divide-[var(--line)] border-t border-[var(--line)] text-sm">
          {order.lines.map((l, i) => {
            const it = menu.byId[l.id];
            if (!it) return null;
            const sub = !!l.g && l.role !== "main";
            return (
              <li key={i} className={`flex items-baseline gap-2 px-4 py-2 ${sub ? "pl-8 text-[var(--ink-2)]" : ""}`}>
                <b className="w-7 shrink-0 tabular-nums">{l.qty}×</b>
                <span className="flex-1">{lang === "nl" ? it.name : it.nameEn}{sub && <em className="ml-1 text-xs not-italic text-[var(--ink-3)]">{t("kWithMenu")}</em>}</span>
              </li>
            );
          })}
        </ul>
      </details>

      <p className="mt-4 text-center text-xs text-[var(--ink-3)]">{t("liveNote")}</p>
      <div className="mt-6"><Btn variant="ghost" onClick={() => router.push("/bestellen")}>{t("newOrder")}</Btn></div>
    </div>,
  );
}

function Row({ icon, children, tone }: { icon: React.ReactNode; children: React.ReactNode; tone?: "alert" }) {
  return (
    <div className={`flex items-start gap-3 rounded-xl px-4 py-3 ${tone === "alert" ? "bg-[var(--amber-soft)] font-semibold" : "bg-[var(--wash)]"}`}>
      <span className="mt-0.5 shrink-0 text-[var(--ink-2)]">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

/** Aftelbalk: van paidAt (of createdAt) tot + wachttijd; onbetaalde barbestelling = grijs op hold. */
function EtaBar({ order, t }: { order: OrderView; t: ReturnType<typeof useTranslations<"food">> }) {
  const ref = useRef<HTMLElement | null>(null);
  const active = order.status === "NEW" || order.status === "PREPARING";
  const span = (order.waitMinutes || WAIT_DEFAULT) * 60_000;
  const startAt = order.paidAt ? new Date(order.paidAt).getTime() : new Date(order.createdAt).getTime();
  const left = startAt + span - Date.now();
  const pct = Math.max(0, Math.min(100, (left / span) * 100));

  useEffect(() => {
    const el = ref.current;
    if (!el || !order.paid || !active) return;
    el.style.transition = "none";
    el.style.width = `${pct.toFixed(1)}%`;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        el.style.transition = `width ${Math.max(0, Math.round(left))}ms linear`;
        el.style.width = "0%";
      }),
    );
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.paid, order.status, order.paidAt]);

  if (!active) return null;
  if (!order.paid) {
    return (
      <div className="mt-5">
        <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]"><i className="block h-full w-full bg-[#C9C6CA]" /></div>
        <p className="mt-1.5 text-center text-xs text-[var(--ink-2)]">{t("etaHold")}</p>
      </div>
    );
  }
  const late = left <= 0;
  const txt = late ? t("etaLate") : left < 60_000 ? t("etaSoon") : t("etaLeft", { n: Math.ceil(left / 60_000) });
  return (
    <div className="mt-5">
      <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]"><i ref={ref} className={`block h-full ${late ? "bg-[var(--amber)]" : "bg-[var(--green)]"}`} style={{ width: `${pct.toFixed(1)}%` }} /></div>
      <p className={`mt-1.5 text-center text-xs ${late ? "font-semibold text-[var(--amber)]" : "text-[var(--ink-2)]"}`}>{txt}</p>
    </div>
  );
}
