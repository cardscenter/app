"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState, useRef, useEffect, useTransition } from "react";
import { createAuction } from "@/actions/auction";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Eye } from "lucide-react";
import type { EnrichedShippingMethod } from "@/components/ui/shipping-method-selector";
import type { AuctionType } from "@/types";

import { StepType } from "./steps/step-type";
import { StepPhotos } from "./steps/step-photos";
import { StepDetails } from "./steps/step-details";
import { StepPricing } from "./steps/step-pricing";
import { MIN_STARTING_BID } from "@/lib/validations/auction";
import { StepTiming } from "./steps/step-timing";
import { StepUpsells, type UpsellWindowEntry, type SelectedLabel } from "./steps/step-upsells";
import { AuctionPreview } from "./steps/step-review";
import { AuctionFormProgress, type AuctionStepKey } from "./auction-form-progress";
import { AuctionFormSummary } from "./auction-form-summary";
import { ShippingMethodDisplay } from "@/components/listing/shipping-method-display";
import type { CardSearchSelectValue } from "@/components/ui/card-search-select";

interface FormState {
  auctionType: AuctionType;
  images: string[];
  title: string;
  description: string;
  cardName: string;
  condition: string;
  tcgdex: CardSearchSelectValue | null;
  variant: "normal" | "reverse";
  productType: string;
  itemCategory: string;
  startingBid: number | null;
  duration: number;
  startDate: Date;
  endTimeOfDay: string;
  hasReserve: boolean;
  reservePrice: number | null;
  hasBuyNow: boolean;
  buyNowPrice: number | null;
  runnerUpEnabled: boolean;
  // Fase 27.95: SHIP / PICKUP / BOTH
  deliveryMethod: "SHIP" | "PICKUP" | "BOTH";
  // Brievenbuspakket opt-in (Fase 33 v2)
  allowMailbox: boolean;
  upsells: UpsellWindowEntry[];
  labels: SelectedLabel[];
}

const INITIAL_STATE: FormState = {
  auctionType: "SINGLE_CARD",
  images: [],
  title: "",
  description: "",
  cardName: "",
  condition: "Near Mint",
  tcgdex: null,
  variant: "normal",
  productType: "",
  itemCategory: "",
  startingBid: null,
  duration: 7,
  // Default startDate = midnight UTC voor vandaag (NL-kalenderdag).
  startDate: (() => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  })(),
  endTimeOfDay: "20:00",
  hasReserve: false,
  reservePrice: null,
  hasBuyNow: false,
  buyNowPrice: null,
  runnerUpEnabled: true,
  deliveryMethod: "SHIP",
  allowMailbox: false,
  upsells: [],
  labels: [],
};

interface MultiStepAuctionFormProps {
  shippingMethods: EnrichedShippingMethod[];
  userBalance: number;
  accountType: string;
  freeUpsellsRemaining?: number;
  userCity?: string | null;
  maxRunnerUpAttempts?: number;
  /** Seller's eigen land (ISO 3166-1 alpha-2) — voor de DOMESTIC-vlag in zone-headers. */
  originCountry?: string | null;
  /** EU_NEAR buurland-codes — voor vlaggen in zone-headers. */
  neighbors?: string[];
}

export function MultiStepAuctionForm({ shippingMethods, userBalance, accountType, freeUpsellsRemaining = 0, userCity = null, maxRunnerUpAttempts = 2, originCountry = null, neighbors = [] }: MultiStepAuctionFormProps) {
  const t = useTranslations("auction");
  const ts = useTranslations("shipping");
  const router = useRouter();
  // Initial state: respect de globale user-instelling — runner-up rotatie kan
  // niet aan staan als de seller 'm op 0 heeft gezet in z'n profiel.
  const [form, setForm] = useState<FormState>(() => ({
    ...INITIAL_STATE,
    runnerUpEnabled: maxRunnerUpAttempts > 0,
  }));
  const [showPreview, setShowPreview] = useState(false);
  const [helperModalOpen, setHelperModalOpen] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();

  // Pricing-helper modal verbergt de sticky bottom-bar tijdelijk — anders
  // schemert die op mobile door de modal-backdrop heen en breekt de focus
  // van de wizard. Helper dispatcht zelf de events.
  useEffect(() => {
    const onOpen = () => setHelperModalOpen(true);
    const onClose = () => setHelperModalOpen(false);
    window.addEventListener("pricing-helper-open", onOpen);
    window.addEventListener("pricing-helper-close", onClose);
    return () => {
      window.removeEventListener("pricing-helper-open", onOpen);
      window.removeEventListener("pricing-helper-close", onClose);
    };
  }, []);

  const [actionState, formAction, pending] = useActionState(
    async (_prev: { error?: string; success?: boolean; auctionId?: string } | null | undefined, formData: FormData) => {
      const result = await createAuction(formData);
      return result ?? null;
    },
    null
  );

  // Redirect on successful auction creation
  useEffect(() => {
    const state = actionState as { success?: boolean; auctionId?: string } | null;
    if (state?.success && state.auctionId) {
      router.push("/veilingen?created=1");
    }
  }, [actionState, router]);

  const updateField = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    const formData = new FormData();
    formData.set("auctionType", form.auctionType);
    formData.set("imageUrls", JSON.stringify(form.images));
    formData.set("title", form.title);
    formData.set("description", form.description);
    formData.set("startingBid", String(form.startingBid ?? ""));
    formData.set("duration", String(form.duration));
    formData.set("startDate", form.startDate.toISOString());
    formData.set("endTimeOfDay", form.endTimeOfDay);

    // Append "(Reverse Holo)" so buyers see which print they're bidding on.
    const baseName = form.cardName;
    const needsReverseSuffix = form.variant === "reverse" && baseName && !/reverse/i.test(baseName);
    const cardName = needsReverseSuffix ? `${baseName} (Reverse Holo)` : baseName;
    if (cardName) formData.set("cardName", cardName);
    if (form.condition) formData.set("condition", form.condition);
    if (form.tcgdex?.id) formData.set("tcgdexId", form.tcgdex.id);
    if (form.productType) formData.set("productType", form.productType);
    if (form.itemCategory) formData.set("itemCategory", form.itemCategory);
    if (form.hasReserve && form.reservePrice !== null) formData.set("reservePrice", String(form.reservePrice));
    if (form.hasBuyNow && form.buyNowPrice !== null) formData.set("buyNowPrice", String(form.buyNowPrice));
    formData.set("runnerUpEnabled", form.runnerUpEnabled ? "1" : "0");
    formData.set("deliveryMethod", form.deliveryMethod);

    // Shipping wordt server-side afgeleid (Fase 33 v2). Seller stuurt alleen
    // de mailbox-toggle mee — STANDARD+SIGNED zijn altijd inbegrepen.
    formData.set("allowMailbox", String(form.allowMailbox));
    // Voor PICKUP/BOTH: stad moet bekend zijn
    if ((form.deliveryMethod === "PICKUP" || form.deliveryMethod === "BOTH") && !userCity) {
      toast.error("Vul eerst je woonplaats in op je profiel");
      return;
    }
    if (form.upsells.length > 0) formData.set("upsells", JSON.stringify(form.upsells));
    if (form.labels.length > 0) formData.set("labels", JSON.stringify(form.labels));

    startTransition(() => {
      formAction(formData);
    });
  };

  // Preview modal
  if (showPreview) {
    return (
      <AuctionPreview
        form={form}
        onBack={() => setShowPreview(false)}
        onPublish={handleSubmit}
        pending={pending}
        error={actionState?.error}
        userCity={userCity}
        maxRunnerUpAttempts={maxRunnerUpAttempts}
        accountType={accountType}
        freeUpsellsRemaining={freeUpsellsRemaining}
      />
    );
  }

  // Welke sectie-stappen zijn lokaal "compleet" — voor de progress-indicator.
  // Houdt rekening met conditionele velden per auctionType (bijv. cardName
  // alleen verplicht voor SINGLE_CARD).
  const completedSteps = new Set<AuctionStepKey>();
  if (form.auctionType) completedSteps.add("type");
  if (form.images.length > 0) completedSteps.add("photos");
  const detailsOk =
    form.title.length >= 3 &&
    (form.auctionType !== "SINGLE_CARD" || (form.cardName?.length ?? 0) > 0);
  if (detailsOk) completedSteps.add("details");
  if (form.startingBid !== null && form.startingBid >= MIN_STARTING_BID) completedSteps.add("pricing");
  if (form.startDate && form.endTimeOfDay) completedSteps.add("timing");
  if (form.deliveryMethod) completedSteps.add("delivery");
  // Promotie is volledig optioneel — markeer als "compleet" zodat de progress
  // niet onnodig met een open chip blijft staan als seller niets selecteert.
  completedSteps.add("promotion");

  // Sticky-bar missing-fields chips.
  const missing: { key: string; label: string }[] = [];
  if (form.images.length === 0) missing.push({ key: "photo", label: t("photoRequired") });
  if (!form.title) missing.push({ key: "title", label: t("titleRequired") });
  if (!form.startingBid || form.startingBid < MIN_STARTING_BID) {
    missing.push({ key: "startingBid", label: t("startingBidRequired") });
  }

  return (
    <div ref={topRef}>
      {/* 2-koloms layout op desktop: form-kolom (met sticky progress bovenaan) · samenvatting rechts.
          Op mobile is alleen de form-kolom zichtbaar; progress is daar full-bleed via negatieve margins. */}
      <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-8">
        <div className="space-y-8">
          <AuctionFormProgress completed={completedSteps} />
          {/* Error message */}
          {actionState?.error && (
            <div className="glass-subtle rounded-2xl bg-red-50/50 p-4 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
              {actionState.error}
            </div>
          )}

          {/* Section 1: Type */}
          <section data-section="type" className="glass rounded-2xl p-6 scroll-mt-32">
            <StepType value={form.auctionType} onChange={(v) => updateField("auctionType", v)} />
          </section>

          {/* Section 2: Photos */}
          <section data-section="photos" className="glass rounded-2xl p-6 scroll-mt-32">
            <StepPhotos auctionType={form.auctionType} images={form.images} onChange={(v) => updateField("images", v)} />
          </section>

          {/* Section 3: Details */}
          <section data-section="details" className="glass rounded-2xl p-6 scroll-mt-32">
            <StepDetails
              auctionType={form.auctionType}
              title={form.title}
              description={form.description}
              cardName={form.cardName}
              condition={form.condition}
              tcgdex={form.tcgdex}
              variant={form.variant}
              productType={form.productType}
              itemCategory={form.itemCategory}
              onChange={updateField}
            />
          </section>

          {/* Section 4: Pricing (zonder duration — die zit nu in Tijdvenster) */}
          <section data-section="pricing" className="glass rounded-2xl p-6 scroll-mt-32">
            <StepPricing
              startingBid={form.startingBid}
              hasReserve={form.hasReserve}
              reservePrice={form.reservePrice}
              hasBuyNow={form.hasBuyNow}
              buyNowPrice={form.buyNowPrice}
              runnerUpEnabled={form.runnerUpEnabled}
              maxRunnerUpAttempts={maxRunnerUpAttempts}
              pricing={form.variant === "reverse" ? (form.tcgdex?.pricingReverse ?? null) : (form.tcgdex?.pricing ?? null)}
              onChange={updateField}
            />
          </section>

          {/* Section 5: Tijdvenster (nieuw) */}
          <section data-section="timing" className="glass rounded-2xl p-6 scroll-mt-32">
            <StepTiming
              startDate={form.startDate}
              duration={form.duration}
              endTimeOfDay={form.endTimeOfDay}
              onChange={updateField}
            />
          </section>

          {/* Section 6a: Bezorging */}
          <section data-section="delivery" className="glass rounded-2xl p-6 scroll-mt-32">
            <h2 className="text-lg font-semibold text-foreground mb-1">{t("deliveryHeader")}</h2>
            <p className="text-sm text-muted-foreground mb-4">{t("deliveryHelp")}</p>
            <div className="flex flex-wrap gap-2">
              {(["SHIP", "PICKUP", "BOTH"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => updateField("deliveryMethod", m)}
                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all ${
                    form.deliveryMethod === m
                      ? "border-primary bg-primary text-white"
                      : "glass-subtle text-foreground hover:bg-muted"
                  }`}
                >
                  {m === "SHIP" ? t("deliveryShip") : m === "PICKUP" ? t("deliveryPickup") : t("deliveryBoth")}
                </button>
              ))}
            </div>

            {/* Pickup-locatie display + warning */}
            {(form.deliveryMethod === "PICKUP" || form.deliveryMethod === "BOTH") && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-foreground mb-1">{t("pickupLocationLabel")}</label>
                {userCity ? (
                  <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground">
                    {userCity}
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    {t("pickupLocationMissing")}
                  </div>
                )}
                <p className="mt-1 text-xs text-muted-foreground">{t("pickupLocationPrivacy")}</p>
              </div>
            )}

            {/* Shipping Methods */}
            {(form.deliveryMethod === "SHIP" || form.deliveryMethod === "BOTH") && (
              <div className="mt-6 border-t border-border pt-6">
                <h3 className="text-sm font-semibold text-foreground mb-1">{ts("selectShippingMethods")}</h3>
                <p className="text-xs text-muted-foreground mb-3">{ts("selectShippingMethodsHint")}</p>
                <ShippingMethodDisplay
                  methods={shippingMethods}
                  listingType={form.auctionType}
                  price={form.buyNowPrice ?? form.startingBid}
                  allowMailbox={form.allowMailbox}
                  onAllowMailboxChange={(next) => updateField("allowMailbox", next)}
                  originCountry={originCountry}
                  neighbors={neighbors}
                />
              </div>
            )}

          </section>

          {/* Section 7: Promotie (eigen sectie — Spotlight-windows + Labels) */}
          <section data-section="promotion" className="glass rounded-2xl p-6 scroll-mt-32">
            <StepUpsells
              upsells={form.upsells}
              labels={form.labels}
              userBalance={userBalance}
              accountType={accountType}
              freeUpsellsRemaining={freeUpsellsRemaining}
              auctionDuration={form.duration}
              reservePrice={form.hasReserve ? form.reservePrice : null}
              buyNowPrice={form.hasBuyNow ? form.buyNowPrice : null}
              condition={form.condition || null}
              auctionType={form.auctionType}
              onUpsellsChange={(v) => updateField("upsells", v)}
              onLabelsChange={(v) => updateField("labels", v)}
            />
          </section>
        </div>

        {/* Sticky samenvatting (lg+) — info-overzicht, geen mock-bid-card */}
        <div className="hidden lg:block">
          <AuctionFormSummary
            auctionType={form.auctionType}
            images={form.images}
            title={form.title}
            description={form.description}
            cardName={form.cardName}
            condition={form.condition}
            productType={form.productType}
            itemCategory={form.itemCategory}
            startingBid={form.startingBid}
            hasReserve={form.hasReserve}
            reservePrice={form.reservePrice}
            hasBuyNow={form.hasBuyNow}
            buyNowPrice={form.buyNowPrice}
            duration={form.duration}
            startDate={form.startDate}
            endTimeOfDay={form.endTimeOfDay}
            deliveryMethod={form.deliveryMethod}
            pickupCity={userCity}
            upsellsCount={form.upsells.length}
          />
        </div>
      </div>

      {/* Submit bar — chip-array voor missing fields + preview-knop.
          Mobile: column gestapeld + items gecentreerd. Desktop: row met
          justify-between.
          Wordt verborgen wanneer de Prijs-helper-modal open is — anders
          schemert 'ie door de modal-backdrop heen op mobile. */}
      <div
        className={`sticky bottom-4 z-10 mt-8 ${helperModalOpen ? "invisible" : ""}`}
        aria-hidden={helperModalOpen}
      >
        <div className="glass rounded-2xl p-4 flex flex-col items-center gap-3 shadow-lg sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
            {missing.length === 0 ? (
              <span className="text-sm text-emerald-700 dark:text-emerald-300">{t("readyToPreview")}</span>
            ) : (
              <>
                {missing.map((m, i) => (
                  <span
                    key={m.key}
                    className={`items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 ${
                      i === 0 ? "inline-flex" : "hidden sm:inline-flex"
                    }`}
                  >
                    {m.label}
                  </span>
                ))}
                {/* Mobile-only "+N meer" counter zodat seller weet dat er nog
                    open errors zijn buiten de eerste. */}
                {missing.length > 1 && (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 sm:hidden">
                    +{missing.length - 1}
                  </span>
                )}
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setShowPreview(true);
              // Direct na mount staat de Preview-tree op dezelfde scroll-pos
              // als de bottom-bar — terug naar boven zodat de seller het
              // overzicht meteen ziet.
              if (typeof window !== "undefined") {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
            disabled={form.images.length === 0 || !form.title || !form.startingBid || form.startingBid < MIN_STARTING_BID}
            className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-primary-hover hover:shadow-lg disabled:opacity-50"
          >
            <Eye className="h-4 w-4" />
            {t("preview")}
          </button>
        </div>
      </div>
    </div>
  );
}
