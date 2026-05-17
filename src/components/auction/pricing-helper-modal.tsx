"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import {
  Sparkles,
  X,
  ShieldCheck,
  Zap,
  Rocket,
  Scale,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle,
} from "lucide-react";
import { MIN_STARTING_BID } from "@/lib/validations/auction";
import { combineDateAndTimeNL, formatNLDateTimeLocal } from "@/lib/auction/timing";

type Strategy = "flash" | "fast" | "standard" | "patient";
type Duration = 3 | 5 | 7 | 14;

interface Advice {
  startingBid: number;
  reservePrice: number | null;
  buyNowPrice: number | null;
  /** Aanbevolen starttijd — nu (live-publish). */
  startTime: Date;
  /** Aanbevolen eindtijd — N dagen vanaf nu om 20:00 (NL-conventie). Seller
   *  kan hierna in step-timing fijn-tunen voor een optimale weekdag. */
  endTime: Date;
  /** Behouden voor display in stap-4 ("Looptijd: N dagen"). Wordt niet
   *  meer als losse veld in de form-state gezet. */
  duration: Duration;
}

interface StrategyConfig {
  duration: Duration;
  /** Startbod als % van marktwaarde. Bij reserve aan wordt dit gehalveerd
   *  (reserve dekt de bodem, dus startbod mag agressiever laag). */
  startingBidPct: number;
  /** Reserveprijs als % van marktwaarde (alleen toegepast als reserve aan). */
  reservePct: number;
  /** Direct Kopen premium-multiplier (1.05 = +5%, 1.20 = +20%). */
  buyNowPct: number;
  /** Default-toggle voor reserve in deze strategie. */
  reserveRecommended: boolean;
  /** Default-toggle voor Direct Kopen in deze strategie. */
  buyNowRecommended: boolean;
}

const STRATEGY_CONFIG: Record<Strategy, StrategyConfig> = {
  // Flash Sale — max urgentie. Lage drempel, geen reserve (haakt kopers af),
  // wel Direct Kopen voor instant-conversie.
  flash: {
    duration: 3,
    startingBidPct: 0.10,
    reservePct: 0.70,
    buyNowPct: 1.05,
    reserveRecommended: false,
    buyNowRecommended: true,
  },
  // Snelle verkoop — urgency-driven, iets meer ruimte voor bod-shopping.
  fast: {
    duration: 5,
    startingBidPct: 0.15,
    reservePct: 0.75,
    buyNowPct: 1.08,
    reserveRecommended: false,
    buyNowRecommended: true,
  },
  // Standaard verkoop — laat marktwerking gebeuren, neutrale defaults.
  standard: {
    duration: 7,
    startingBidPct: 0.30,
    reservePct: 0.80,
    buyNowPct: 1.12,
    reserveRecommended: false,
    buyNowRecommended: false,
  },
  // Geduldige verkoop — max bereik + bodembescherming. Reserve aan om je
  // tegen te-lage opbrengst te beschermen, Direct Kopen uit zodat geen
  // bidding-war voortijdig wordt afgekapt.
  patient: {
    duration: 14,
    startingBidPct: 0.50,
    reservePct: 0.85,
    buyNowPct: 1.20,
    reserveRecommended: true,
    buyNowRecommended: false,
  },
};

interface PricingHelperModalProps {
  open: boolean;
  onClose: () => void;
  /** Past startbod, reserveprijs, Direct Kopen-prijs én looptijd ineens toe op
   *  het form. null = die optie niet ingeschakeld (toggles gaan dan uit). */
  onApply: (advice: Advice) => void;
  /** Pre-fill marktwaarde — bv. TCGdex CardMarket-avg als die beschikbaar is.
   *  Wordt elke keer dat de modal opent als startwaarde gebruikt. */
  defaultValue?: number | null;
}

const STEP_COUNT = 4;

function roundToNiceStep(amount: number): number {
  if (amount < 50) return Math.round(amount / 5) * 5;
  if (amount < 500) return Math.round(amount / 10) * 10;
  if (amount < 5000) return Math.round(amount / 25) * 25;
  return Math.round(amount / 50) * 50;
}

function computeAdvice(
  value: number,
  strategy: Strategy,
  wantReserve: boolean,
  wantBuyNow: boolean,
  duration: Duration,
): Advice {
  const cfg = STRATEGY_CONFIG[strategy];

  let startingBidPct = cfg.startingBidPct;
  if (wantReserve) startingBidPct *= 0.5;
  const startingBid = Math.max(MIN_STARTING_BID, roundToNiceStep(value * startingBidPct));

  let reservePrice: number | null = null;
  if (wantReserve) {
    let r = roundToNiceStep(value * cfg.reservePct);
    if (r < startingBid) r = startingBid + 5;
    reservePrice = r;
  }

  let buyNowPrice: number | null = null;
  if (wantBuyNow) {
    let b = roundToNiceStep(value * cfg.buyNowPct);
    const floor = Math.max(reservePrice ?? 0, startingBid);
    if (b <= floor) b = Math.max(roundToNiceStep(floor * 1.10), floor + 5);
    buyNowPrice = b;
  }

  // Compute start/end-time uit duration. Start = nu (live-publish). Eind =
  // op de NL-kalenderdag (vandaag + duration) om 20:00 NL-tijd. 20:00 valt
  // midden in de sweet-spot 19-21u die de hoogste bid-activiteit trekt.
  // Seller kan in step-timing nog naar 19:30 of zaterdag schuiven indien
  // gewenst — de rating-block geeft daar feedback over.
  const startTime = new Date();
  const todayNL = formatNLDateTimeLocal(startTime).split("T")[0]; // "yyyy-MM-dd"
  const [y, m, d] = todayNL.split("-").map(Number);
  // Calendar-day-only Date in UTC-midnight (zoals combineDateAndTimeNL
  // verwacht). +duration dagen telt op kalenderdag-niveau.
  const targetCalendarDay = new Date(Date.UTC(y, m - 1, d + duration, 0, 0, 0));
  const endTime = combineDateAndTimeNL(targetCalendarDay, "20:00");

  return { startingBid, reservePrice, buyNowPrice, startTime, endTime, duration };
}

function formatEuro(n: number): string {
  return `€${n.toLocaleString("nl-NL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function PricingHelperModal({ open, onClose, onApply, defaultValue }: PricingHelperModalProps) {
  const t = useTranslations("auction");

  const [step, setStep] = useState(1);
  const [value, setValue] = useState<number | null>(null);
  const [strategy, setStrategy] = useState<Strategy>("standard");
  const [wantReserve, setWantReserve] = useState(false);
  const [wantBuyNow, setWantBuyNow] = useState(false);
  const [duration, setDuration] = useState<Duration>(7);
  // Of de seller de looptijd handmatig heeft gewijzigd — anders wordt 'ie
  // automatisch op basis van strategie bijgesteld.
  const [durationManuallySet, setDurationManuallySet] = useState(false);

  // Reset bij elke open-event. Marktwaarde pre-fillt uit `defaultValue` als die
  // beschikbaar is (bv. CardMarket-avg van de gekozen TCGdex-kaart), afgerond
  // op hele euro's zodat het voelt als een ronde marktwaarde.
  useEffect(() => {
    if (open) {
      const initialStrategy: Strategy = "standard";
      const cfg = STRATEGY_CONFIG[initialStrategy];
      setStep(1);
      setValue(
        defaultValue !== null && defaultValue !== undefined && defaultValue > 0
          ? Math.round(defaultValue)
          : null,
      );
      setStrategy(initialStrategy);
      setWantReserve(cfg.reserveRecommended);
      setWantBuyNow(cfg.buyNowRecommended);
      setDuration(cfg.duration);
      setDurationManuallySet(false);
    }
  }, [open, defaultValue]);

  // Tier-wissel her-synct alle downstream-keuzes naar de aanbevelingen van
  // de gekozen strategie: looptijd, reserve aan/uit, Direct Kopen aan/uit.
  // Predictable wizard-gedrag: ga je terug naar stap 1 en kies je een andere
  // strategie, dan zie je op de volgende stappen meteen de juiste defaults.
  useEffect(() => {
    if (!open) return;
    const cfg = STRATEGY_CONFIG[strategy];
    if (!durationManuallySet) setDuration(cfg.duration);
    setWantReserve(cfg.reserveRecommended);
    setWantBuyNow(cfg.buyNowRecommended);
  }, [strategy, open, durationManuallySet]);

  // DOM-event publishen op open/close zodat de parent-form de sticky bottom-
  // bar tijdelijk kan verbergen — op mobile zou die anders door de modal-
  // backdrop heen schemeren en de focus van de wizard breken.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent(open ? "pricing-helper-open" : "pricing-helper-close"),
    );
    return () => {
      if (open) window.dispatchEvent(new CustomEvent("pricing-helper-close"));
    };
  }, [open]);

  // Body-scroll-lock zolang modal open is — voorkomt dat de pagina onder
  // de modal mee-scrollt op mobile. We saven en restoren de original style.
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const original = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      width: document.body.style.width,
      top: document.body.style.top,
    };
    const scrollY = window.scrollY;
    // iOS Safari accepteert geen simpele overflow:hidden voor scroll-lock —
    // position:fixed + behouden scrollY is de werkende combo.
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.style.top = `-${scrollY}px`;
    return () => {
      document.body.style.overflow = original.overflow;
      document.body.style.position = original.position;
      document.body.style.width = original.width;
      document.body.style.top = original.top;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const hasValue = value !== null && value > 0;
  const advice = hasValue ? computeAdvice(value!, strategy, wantReserve, wantBuyNow, duration) : null;

  const canAdvance = step === 1 ? hasValue : true;
  const isLastStep = step === STEP_COUNT;

  const handleNext = () => {
    if (!canAdvance) return;
    if (isLastStep) {
      if (advice) {
        onApply(advice);
        onClose();
      }
      return;
    }
    setStep((s) => Math.min(STEP_COUNT, s + 1));
  };

  const handleBack = () => {
    setStep((s) => Math.max(1, s - 1));
  };

  return createPortal(
    // Mobile: full-screen popup (modal vult viewport, dekt sticky bottom-bar
    // én eventuele andere page-UI volledig af). Desktop: gecenterde dialog
    // met backdrop-blur — zelfde look als voorheen.
    // Via createPortal in document.body ontsnappen we elke parent stacking-
    // context (sticky form-progress, transformed ancestors) die `fixed`
    // anders trapt en de modal "binnen het element" zou houden.
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-background sm:items-center sm:justify-center sm:overflow-y-auto sm:bg-black/50 sm:p-4 sm:backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pricing-helper-title"
    >
      <div
        className="flex h-full w-full flex-col bg-background sm:my-8 sm:h-auto sm:max-w-lg sm:rounded-2xl sm:border sm:border-border sm:shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header met progress dots */}
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="size-4" />
              </span>
              <h3 id="pricing-helper-title" className="text-lg font-semibold text-foreground">
                {t("pricingHelperTitle")}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted"
              aria-label={t("pricingHelperClose")}
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-1.5">
            {Array.from({ length: STEP_COUNT }, (_, i) => i + 1).map((n) => (
              <div
                key={n}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  n <= step ? "bg-primary" : "bg-muted"
                }`}
                aria-current={n === step ? "step" : undefined}
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {t("pricingHelperStepIndicator", { current: step, total: STEP_COUNT })}
          </p>
        </div>

        {/* Body — flex-1 + overflow-y-auto zodat 'ie scrollt op mobile als de
            content niet past, terwijl header/footer static aan top/bottom
            geplakt blijven. Op desktop blijft het content-driven height. */}
        <div className="min-h-[280px] flex-1 overflow-y-auto px-6 py-5">
          {step === 1 && (
            <Step1
              value={value}
              onValueChange={setValue}
              strategy={strategy}
              onStrategyChange={setStrategy}
            />
          )}
          {step === 2 && (
            <Step2
              wantReserve={wantReserve}
              onWantReserveChange={setWantReserve}
              strategy={strategy}
            />
          )}
          {step === 3 && (
            <Step3
              wantBuyNow={wantBuyNow}
              onWantBuyNowChange={setWantBuyNow}
              strategy={strategy}
            />
          )}
          {step === 4 && advice && (
            <Step4
              advice={advice}
              wantReserve={wantReserve}
              wantBuyNow={wantBuyNow}
              duration={duration}
              onDurationChange={(d) => {
                setDuration(d);
                setDurationManuallySet(true);
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={step === 1 ? onClose : handleBack}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {step === 1 ? (
              t("pricingHelperCancel")
            ) : (
              <>
                <ChevronLeft className="size-4" />
                {t("pricingHelperBack")}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!canAdvance}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLastStep ? (
              <>
                <Check className="size-4" />
                {t("pricingHelperApply")}
              </>
            ) : (
              <>
                {t("pricingHelperNext")}
                <ChevronRight className="size-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── Step components ─────────────────────────────────────────────────── */

function Step1({
  value,
  onValueChange,
  strategy,
  onStrategyChange,
}: {
  value: number | null;
  onValueChange: (v: number | null) => void;
  strategy: Strategy;
  onStrategyChange: (s: Strategy) => void;
}) {
  const t = useTranslations("auction");
  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-base font-semibold text-foreground">{t("pricingHelperStep1Title")}</h4>
        <p className="mt-1 text-xs text-muted-foreground">{t("pricingHelperStep1Sub")}</p>
      </div>

      <div>
        <label htmlFor="helper-value" className="block text-sm font-medium text-foreground">
          {t("pricingHelperQ1")}
        </label>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-muted-foreground">&euro;</span>
          <input
            id="helper-value"
            type="number"
            step="0.01"
            min={0}
            value={value ?? ""}
            onKeyDown={(e) => {
              if (e.key === "-" || e.key === "e" || e.key === "+") e.preventDefault();
            }}
            onChange={(e) => {
              if (!e.target.value) {
                onValueChange(null);
                return;
              }
              const parsed = parseFloat(e.target.value);
              if (Number.isNaN(parsed)) return;
              onValueChange(parsed < 0 ? 0 : parsed);
            }}
            className="block w-48 glass-input px-3 py-2.5 text-foreground"
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t("pricingHelperQ1Hint")}</p>
      </div>

      <div>
        <span className="block text-sm font-medium text-foreground">{t("pricingHelperQ2")}</span>
        <div className="mt-2 grid grid-cols-1 gap-2">
          <StrategyOption
            checked={strategy === "flash"}
            onSelect={() => onStrategyChange("flash")}
            title={t("pricingHelperStrategyFlash")}
            desc={t("pricingHelperStrategyFlashDesc")}
            icon={<Zap className="size-4" />}
            badge="3 dagen"
          />
          <StrategyOption
            checked={strategy === "fast"}
            onSelect={() => onStrategyChange("fast")}
            title={t("pricingHelperStrategyFast")}
            desc={t("pricingHelperStrategyFastDesc")}
            icon={<Rocket className="size-4" />}
            badge="5 dagen"
          />
          <StrategyOption
            checked={strategy === "standard"}
            onSelect={() => onStrategyChange("standard")}
            title={t("pricingHelperStrategyStandard")}
            desc={t("pricingHelperStrategyStandardDesc")}
            icon={<Scale className="size-4" />}
            badge="7 dagen"
          />
          <StrategyOption
            checked={strategy === "patient"}
            onSelect={() => onStrategyChange("patient")}
            title={t("pricingHelperStrategyPatient")}
            desc={t("pricingHelperStrategyPatientDesc")}
            icon={<ShieldCheck className="size-4" />}
            badge="14 dagen"
          />
        </div>
      </div>
    </div>
  );
}

function Step2({
  wantReserve,
  onWantReserveChange,
  strategy,
}: {
  wantReserve: boolean;
  onWantReserveChange: (v: boolean) => void;
  strategy: Strategy;
}) {
  const t = useTranslations("auction");
  const recommended = STRATEGY_CONFIG[strategy].reserveRecommended;
  const prosKeys = [
    "pricingHelperReserveProsA",
    "pricingHelperReserveProsB",
    "pricingHelperReserveProsC",
  ];
  const consKeys = [
    "pricingHelperReserveConsA",
    "pricingHelperReserveConsB",
    "pricingHelperReserveConsC",
  ];
  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-base font-semibold text-foreground">{t("pricingHelperStep2Title")}</h4>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {t("pricingHelperReserveInfo")}
        </p>
      </div>

      <RecommendationBanner
        recommended={recommended}
        strategyLabel={t(`pricingHelperStrategy${capitalize(strategy)}`)}
        recommendedLabel={t("pricingHelperRecommended")}
        notRecommendedLabel={t("pricingHelperNotRecommended")}
      />

      <ProsConsCards prosKeys={prosKeys} consKeys={consKeys} />

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4">
        <span className="text-sm font-medium text-foreground">{t("pricingHelperQ3")}</span>
        <YesNoToggle value={wantReserve} onChange={onWantReserveChange} />
      </div>
    </div>
  );
}

function Step3({
  wantBuyNow,
  onWantBuyNowChange,
  strategy,
}: {
  wantBuyNow: boolean;
  onWantBuyNowChange: (v: boolean) => void;
  strategy: Strategy;
}) {
  const t = useTranslations("auction");
  const recommended = STRATEGY_CONFIG[strategy].buyNowRecommended;
  const prosKeys = [
    "pricingHelperBuyNowProsA",
    "pricingHelperBuyNowProsB",
    "pricingHelperBuyNowProsC",
  ];
  const consKeys = [
    "pricingHelperBuyNowConsA",
    "pricingHelperBuyNowConsB",
    "pricingHelperBuyNowConsC",
  ];
  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-base font-semibold text-foreground">{t("pricingHelperStep3Title")}</h4>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {t("pricingHelperBuyNowInfo")}
        </p>
      </div>

      <RecommendationBanner
        recommended={recommended}
        strategyLabel={t(`pricingHelperStrategy${capitalize(strategy)}`)}
        recommendedLabel={t("pricingHelperRecommended")}
        notRecommendedLabel={t("pricingHelperNotRecommended")}
      />

      <ProsConsCards prosKeys={prosKeys} consKeys={consKeys} />

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4">
        <span className="text-sm font-medium text-foreground">{t("pricingHelperQ4")}</span>
        <YesNoToggle value={wantBuyNow} onChange={onWantBuyNowChange} />
      </div>
    </div>
  );
}

function Step4({
  advice,
  wantReserve,
  wantBuyNow,
  duration,
  onDurationChange,
}: {
  advice: Advice;
  wantReserve: boolean;
  wantBuyNow: boolean;
  duration: Duration;
  onDurationChange: (d: Duration) => void;
}) {
  const t = useTranslations("auction");
  const durations: Duration[] = [3, 5, 7, 14];

  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-base font-semibold text-foreground">{t("pricingHelperStep4Title")}</h4>
        <p className="mt-1 text-xs text-muted-foreground">{t("pricingHelperStep4Sub")}</p>
      </div>

      <div>
        <span className="block text-sm font-medium text-foreground">{t("pricingHelperQ5")}</span>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {durations.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onDurationChange(d)}
              aria-pressed={duration === d}
              className={`rounded-lg border px-2 py-2.5 text-sm font-semibold transition-colors ${
                duration === d
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-foreground hover:bg-muted"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {t("pricingHelperDurationHint")}
        </p>
      </div>

      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h5 className="text-sm font-semibold text-foreground">
            {t("pricingHelperAdviceTitle")}
          </h5>
        </div>
        <dl className="space-y-1.5 text-sm">
          <AdviceRow label={t("startingBid")} value={formatEuro(advice.startingBid)} />
          <AdviceRow
            label={t("reservePrice")}
            value={advice.reservePrice !== null ? formatEuro(advice.reservePrice) : t("pricingHelperNoOption")}
            muted={!wantReserve}
          />
          <AdviceRow
            label={t("buyNowPrice")}
            value={advice.buyNowPrice !== null ? formatEuro(advice.buyNowPrice) : t("pricingHelperNoOption")}
            muted={!wantBuyNow}
          />
          <AdviceRow label={t("duration")} value={`${duration} ${t("pricingHelperDays")}`} />
        </dl>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          {t("pricingHelperAdviceFootnote")}
        </p>
      </div>
    </div>
  );
}

/* ── Shared bits ─────────────────────────────────────────────────────── */

function StrategyOption({
  checked,
  onSelect,
  title,
  desc,
  icon,
  badge,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  desc: string;
  icon: React.ReactNode;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={checked}
      className={`flex items-start gap-2 rounded-xl border p-3 text-left transition-colors ${
        checked ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted"
      }`}
    >
      <span
        className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${
          checked ? "bg-primary text-white" : "bg-muted text-muted-foreground"
        }`}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center justify-between gap-2">
          <span className="block text-sm font-medium text-foreground">{title}</span>
          {badge && (
            <span
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                checked
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{desc}</span>
      </span>
    </button>
  );
}

function YesNoToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const t = useTranslations("auction");
  return (
    <div className="flex items-center gap-2">
      <span
        className={`text-xs font-medium ${value ? "text-muted-foreground" : "text-foreground"}`}
      >
        {t("pricingHelperNo")}
      </span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        aria-pressed={value}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          value ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-5" : ""
          }`}
        />
      </button>
      <span
        className={`text-xs font-medium ${value ? "text-foreground" : "text-muted-foreground"}`}
      >
        {t("pricingHelperYes")}
      </span>
    </div>
  );
}

function ProsConsCards({ prosKeys, consKeys }: { prosKeys: string[]; consKeys: string[] }) {
  const t = useTranslations("auction");
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-700/40 dark:bg-emerald-500/5">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
          <Check className="size-3.5" />
          {t("pricingHelperPros")}
        </div>
        <ul className="space-y-1.5 text-[12px] leading-snug text-foreground">
          {prosKeys.map((k) => (
            <li key={k} className="flex gap-1.5">
              <span aria-hidden className="mt-1 size-1 shrink-0 rounded-full bg-emerald-500" />
              <span>{t(k)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 dark:border-rose-700/40 dark:bg-rose-500/5">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300">
          <AlertCircle className="size-3.5" />
          {t("pricingHelperCons")}
        </div>
        <ul className="space-y-1.5 text-[12px] leading-snug text-foreground">
          {consKeys.map((k) => (
            <li key={k} className="flex gap-1.5">
              <span aria-hidden className="mt-1 size-1 shrink-0 rounded-full bg-rose-500" />
              <span>{t(k)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function RecommendationBanner({
  recommended,
  strategyLabel,
  recommendedLabel,
}: {
  recommended: boolean;
  strategyLabel: string;
  recommendedLabel: string;
  /** Backward-compat — niet meer gerenderd, banner toont alleen positieve
   *  aanbeveling. "Niet geschikt" zou kopers kunnen afschrikken. */
  notRecommendedLabel?: string;
}) {
  if (!recommended) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-700/40 dark:bg-emerald-500/10 dark:text-emerald-200">
      <Check className="size-4 shrink-0" />
      <span>
        {recommendedLabel} <span className="font-semibold">{strategyLabel}</span>
      </span>
    </div>
  );
}

function AdviceRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`font-semibold tabular-nums ${muted ? "text-muted-foreground/60" : "text-foreground"}`}>
        {value}
      </dd>
    </div>
  );
}
