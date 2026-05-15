"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState, useRef, useEffect, useMemo } from "react";
import { createListing } from "@/actions/listing";
import { Link, useRouter } from "@/i18n/navigation";
import { Eye } from "lucide-react";
import type { Series, CardSet } from "@prisma/client";
import type { ListingType, DeliveryMethod, PackageSize, Carrier, UpsellType } from "@/types";

import { StepType } from "./steps/step-type";
import { StepPhotos } from "./steps/step-photos";
import { StepDetails } from "./steps/step-details";
import { StepPricing } from "./steps/step-pricing";
import { StepUpsells } from "./steps/step-upsells";
import type { EnrichedShippingMethod } from "@/components/ui/shipping-method-selector";
import { ShippingMethodDisplay } from "./shipping-method-display";
import { ListingPreview } from "./steps/step-review";
import { ListingFormProgress, type ListingStepKey } from "./listing-form-progress";
import { ListingFormSummary } from "./listing-form-summary";
import { mailboxEligibleType } from "@/lib/listing-types";
import type { CardSearchSelectValue } from "@/components/ui/card-search-select";
import type { LabelColor, LabelType as ListingLabelType } from "@/lib/listing/labels";

type SeriesWithSets = Series & { cardSets: CardSet[] };

interface UpsellEntry {
  type: UpsellType;
  days: number;
}

export interface SelectedListingLabel {
  type: ListingLabelType;
  colorKey: LabelColor;
}

interface FormState {
  listingType: ListingType;
  images: string[];
  title: string;
  description: string;
  cardName: string;
  cardSetId: string;
  selectedSeries: string;
  condition: string;
  conditionRange: string;
  tcgdex: CardSearchSelectValue | null;
  variant: "normal" | "reverse";
  productType: string;
  itemCategory: string;
  pricingType: string;
  price: number | null;
  suggestedPrice: number | null;
  allowDirectBuy: boolean;
  acceptsOffers: boolean;
  allowPlatformPickup: boolean;
  allowExternalPickup: boolean;
  deliveryMethod: DeliveryMethod;
  freeShipping: boolean;
  shippingCost: number;
  carriers: Carrier[];
  packageSize: PackageSize | "";
  packageCount: number;
  stockQuantity: number;
  allowMailbox: boolean;
  upsells: UpsellEntry[];
  labels: SelectedListingLabel[];
}

const INITIAL_STATE: FormState = {
  listingType: "SINGLE_CARD",
  images: [],
  title: "",
  description: "",
  cardName: "",
  cardSetId: "",
  selectedSeries: "",
  condition: "Near Mint",
  conditionRange: "",
  tcgdex: null,
  variant: "normal",
  productType: "",
  itemCategory: "",
  pricingType: "FIXED",
  price: null,
  suggestedPrice: null,
  allowDirectBuy: true,
  acceptsOffers: true,
  allowPlatformPickup: true,
  // Default uit: koper betalen aan jou ter plekke is eigen-risico (geen escrow,
  // geen platform-bescherming). Sellers die het toch willen toestaan kunnen
  // het bewust aanvinken.
  allowExternalPickup: false,
  deliveryMethod: "SHIP",
  freeShipping: false,
  shippingCost: 0,
  carriers: [],
  packageSize: "",
  packageCount: 1,
  stockQuantity: 1,
  allowMailbox: false,
  upsells: [],
  labels: [],
};

type SectionId = "type" | "photos" | "details" | "pricing" | "delivery" | "promotion";

type Requirement = { key: string; messageKey: string; section: SectionId; profileLink?: boolean };

function buildRequirements(
  form: FormState,
  userCity: string | null,
  shippingMethodsAvailable: number,
): Requirement[] {
  const reqs: Requirement[] = [];

  if (form.images.length === 0) {
    reqs.push({ key: "photos", messageKey: "photoRequired", section: "photos" });
  }
  if (form.title.trim().length < 3) {
    reqs.push({ key: "title", messageKey: "titleRequired", section: "details" });
  }
  const descText = form.description.replace(/<[^>]*>/g, "").trim();
  if (descText.length < 10) {
    reqs.push({ key: "description", messageKey: "descriptionRequired", section: "details" });
  }
  if (form.listingType === "SINGLE_CARD") {
    if (!form.cardName.trim()) {
      reqs.push({ key: "cardName", messageKey: "cardNameRequired", section: "details" });
    }
    if (!form.condition) {
      reqs.push({ key: "condition", messageKey: "conditionRequired", section: "details" });
    }
  }
  if (form.listingType === "SEALED_PRODUCT") {
    if (!form.productType) {
      reqs.push({ key: "productType", messageKey: "productTypeRequired", section: "details" });
    }
  }
  if (form.pricingType === "FIXED" && (!form.price || form.price <= 0)) {
    reqs.push({ key: "price", messageKey: "priceRequired", section: "pricing" });
  }
  if (form.pricingType === "FIXED" && !form.allowDirectBuy && !form.acceptsOffers) {
    reqs.push({ key: "buyOptions", messageKey: "buyOptionsRequired", section: "pricing" });
  }

  const isPickup = form.deliveryMethod === "PICKUP" || form.deliveryMethod === "BOTH";
  const isShip = form.deliveryMethod === "SHIP" || form.deliveryMethod === "BOTH";

  if (isPickup && !userCity) {
    reqs.push({ key: "pickupCity", messageKey: "pickupCityRequired", section: "delivery", profileLink: true });
  }
  if (isPickup && !form.allowPlatformPickup && !form.allowExternalPickup) {
    reqs.push({ key: "pickupPayment", messageKey: "pickupPaymentRequired", section: "delivery" });
  }
  if (isShip && shippingMethodsAvailable === 0) {
    reqs.push({
      key: "shippingMethod",
      messageKey: "shippingMethodNoneAvailable",
      section: "delivery",
    });
  }

  return reqs;
}

interface MultiStepListingFormProps {
  seriesList: SeriesWithSets[];
  userBalance: number;
  userAccountType: string;
  freeUpsellsRemaining?: number;
  userCity?: string | null;
  shippingMethods?: EnrichedShippingMethod[];
  originCountry?: string | null;
  neighbors?: string[];
}

export function MultiStepListingForm({
  seriesList,
  userBalance,
  userAccountType,
  freeUpsellsRemaining = 0,
  userCity = null,
  shippingMethods = [],
  originCountry = null,
  neighbors = [],
}: MultiStepListingFormProps) {
  const t = useTranslations("listing");
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [showPreview, setShowPreview] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  // Effectieve verzendmethode-ids voor server-snapshot. STANDARD+SIGNED altijd,
  // MAILBOX alleen als toggle aan + type-eligible + price < €150. Server-side
  // is dezelfde derivation autoritair (deriveListingShippingMethodIds).
  const effectiveShippingMethodIds = useMemo(() => {
    const mailboxOk =
      form.allowMailbox &&
      mailboxEligibleType(form.listingType) &&
      (form.price === null || form.price < 150);
    return shippingMethods
      .filter((m) => m.isActive)
      .filter((m) => {
        if (m.service === "PARCEL_STANDARD" || m.service === "PARCEL_SIGNED") return true;
        if (m.service === "MAILBOX_PARCEL") return mailboxOk;
        return false;
      })
      .map((m) => m.id);
  }, [shippingMethods, form.allowMailbox, form.listingType, form.price]);

  const [actionState, formAction, pending] = useActionState(
    async (_prev: { error?: string; success?: boolean; listingId?: string } | null | undefined, formData: FormData) => {
      const result = await createListing(formData);
      return result ?? null;
    },
    null
  );

  useEffect(() => {
    if (actionState && "success" in actionState && actionState.success && actionState.listingId) {
      router.push(`/marktplaats/${actionState.listingId}`);
    }
  }, [actionState, router]);

  useEffect(() => {
    if (actionState?.error) {
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [actionState?.error]);

  const updateField = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const requirements = useMemo(
    () => buildRequirements(form, userCity, shippingMethods.filter((m) => m.isActive).length),
    [form, userCity, shippingMethods]
  );
  const isReadyToPublish = requirements.length === 0;

  // Completed-steps voor de sticky progress-chips. Optionele sectie (promotion)
  // markeren we altijd als compleet zodat de chip niet onnodig amber blijft.
  const completedSteps = new Set<ListingStepKey>();
  if (form.listingType) completedSteps.add("type");
  if (form.images.length > 0) completedSteps.add("photos");
  if (!requirements.some((r) => r.section === "details")) completedSteps.add("details");
  if (!requirements.some((r) => r.section === "pricing")) completedSteps.add("pricing");
  if (!requirements.some((r) => r.section === "delivery")) completedSteps.add("delivery");
  completedSteps.add("promotion"); // altijd optioneel

  // Missing-chips voor sticky bar (max 6 om wall-of-chips te voorkomen — eerste
  // 6 in volgorde, rest wordt impliciet aangewezen door het feit dat de
  // preview-knop disabled blijft).
  const missing = requirements.slice(0, 6).map((r) => ({ key: r.key, label: t(r.messageKey) }));

  const buildFormData = () => {
    const formData = new FormData();
    formData.set("listingType", form.listingType);
    formData.set("imageUrls", JSON.stringify(form.images));
    formData.set("title", form.title);
    formData.set("description", form.description);
    formData.set("pricingType", form.pricingType);
    formData.set("deliveryMethod", form.deliveryMethod);
    formData.set("freeShipping", String(form.freeShipping));
    formData.set("shippingCost", String(form.shippingCost));
    formData.set("packageCount", String(form.packageCount));

    const baseName = form.cardName;
    const needsReverseSuffix = form.variant === "reverse" && baseName && !/reverse/i.test(baseName);
    const cardName = needsReverseSuffix ? `${baseName} (Reverse Holo)` : baseName;
    if (cardName) formData.set("cardName", cardName);
    if (form.cardSetId) formData.set("cardSetId", form.cardSetId);
    if (form.condition) formData.set("condition", form.condition);
    if (form.conditionRange) formData.set("conditionRange", form.conditionRange);
    if (form.tcgdex?.id) formData.set("tcgdexId", form.tcgdex.id);
    if (form.price !== null) formData.set("price", String(form.price));
    formData.set("allowMailbox", String(form.allowMailbox));
    if (form.carriers.length > 0) formData.set("carriers", JSON.stringify(form.carriers));
    if (form.packageSize) formData.set("packageSize", form.packageSize);
    if (form.productType) formData.set("productType", form.productType);
    if (form.itemCategory) formData.set("itemCategory", form.itemCategory);
    if (form.listingType === "SEALED_PRODUCT" || form.listingType === "OTHER") {
      formData.set("stockQuantity", String(Math.max(1, form.stockQuantity)));
    }
    if (form.upsells.length > 0) formData.set("upsells", JSON.stringify(form.upsells));
    if (form.labels.length > 0) formData.set("labels", JSON.stringify(form.labels));
    if (form.suggestedPrice !== null && form.pricingType === "NEGOTIABLE") {
      formData.set("suggestedPrice", String(form.suggestedPrice));
    }
    formData.set("allowDirectBuy", String(form.allowDirectBuy));
    formData.set("acceptsOffers", String(form.acceptsOffers));
    formData.set("allowPlatformPickup", String(form.allowPlatformPickup));
    formData.set("allowExternalPickup", String(form.allowExternalPickup));
    return formData;
  };

  const handleSubmit = () => formAction(buildFormData());

  if (showPreview) {
    return (
      <ListingPreview
        form={form}
        accountType={userAccountType}
        selectedShippingMethods={effectiveShippingMethodIds}
        shippingMethods={shippingMethods}
        missingRequirements={requirements.map((r) => ({ key: r.key, messageKey: r.messageKey }))}
        onBack={() => setShowPreview(false)}
        onPublish={handleSubmit}
        pending={pending}
        error={actionState?.error}
      />
    );
  }

  return (
    <div ref={topRef}>
      {/* 2-koloms layout op desktop: form-kolom (sticky progress bovenaan) ·
          samenvatting rechts. Mobile: alleen form-kolom; progress full-bleed
          via negatieve margins. */}
      <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-8">
        <div className="space-y-8">
          <ListingFormProgress completed={completedSteps} />

          {actionState?.error && (
            <div className="glass-subtle rounded-2xl bg-red-50/50 p-4 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
              {actionState.error}
            </div>
          )}

          {/* Section 1: Type */}
          <section data-section="type" className="glass rounded-2xl p-6 scroll-mt-32">
            <StepType value={form.listingType} onChange={(v) => updateField("listingType", v)} />
          </section>

          {/* Section 2: Photos */}
          <section data-section="photos" className="glass rounded-2xl p-6 scroll-mt-32">
            <StepPhotos listingType={form.listingType} images={form.images} onChange={(v) => updateField("images", v)} />
          </section>

          {/* Section 3: Details */}
          <section data-section="details" className="glass rounded-2xl p-6 scroll-mt-32">
            <StepDetails
              listingType={form.listingType}
              seriesList={seriesList}
              title={form.title}
              description={form.description}
              cardName={form.cardName}
              cardSetId={form.cardSetId}
              selectedSeries={form.selectedSeries}
              condition={form.condition}
              tcgdex={form.tcgdex}
              variant={form.variant}
              productType={form.productType}
              itemCategory={form.itemCategory}
              stockQuantity={form.stockQuantity}
              onChange={updateField}
            />
          </section>

          {/* Section 4: Pricing */}
          <section data-section="pricing" className="glass rounded-2xl p-6 scroll-mt-32">
            <StepPricing
              pricingType={form.pricingType}
              price={form.price}
              suggestedPrice={form.suggestedPrice}
              allowDirectBuy={form.allowDirectBuy}
              acceptsOffers={form.acceptsOffers}
              pricing={form.variant === "reverse" ? (form.tcgdex?.pricingReverse ?? null) : (form.tcgdex?.pricing ?? null)}
              onChange={updateField}
            />
          </section>

          {/* Section 5: Bezorging (combinatie van delivery-method, pickup-locatie,
              pickup-payment-modi en shipping-methods) */}
          <section data-section="delivery" className="glass rounded-2xl p-6 scroll-mt-32">
            <h2 className="text-lg font-semibold text-foreground mb-1">{t("stepShipping")}</h2>
            <p className="text-sm text-muted-foreground mb-4">{t("shippingMethodsHint")}</p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-2">{t("deliveryMethodLabel")}</label>
              <div className="flex flex-wrap gap-2">
                {(["SHIP", "PICKUP", "BOTH"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        deliveryMethod: m,
                        // Bij PICKUP-only is gratis verzending niet relevant —
                        // wis stale toggle-state om verwarring en server-noise te
                        // voorkomen.
                        freeShipping: m === "PICKUP" ? false : prev.freeShipping,
                      }));
                    }}
                    className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all ${
                      form.deliveryMethod === m
                        ? "border-primary bg-primary text-white"
                        : "glass-subtle text-foreground hover:bg-muted"
                    }`}
                  >
                    {t(m === "SHIP" ? "deliveryShip" : m === "PICKUP" ? "deliveryPickup" : "deliveryBoth")}
                  </button>
                ))}
              </div>
            </div>

            {(form.deliveryMethod === "PICKUP" || form.deliveryMethod === "BOTH") && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-1">{t("pickupLocation.label")}</label>
                {userCity ? (
                  <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground">
                    {userCity}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    <span>
                      {t.rich("pickupLocation.noCityWarning", {
                        link: (chunks) => (
                          <Link href="/dashboard/verzending" className="font-medium underline-offset-2 hover:underline">
                            {chunks}
                          </Link>
                        ),
                      })}
                    </span>
                    <Link
                      href="/dashboard/profiel"
                      className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-700"
                    >
                      {t("pickupCityRequiredAction")}
                    </Link>
                  </div>
                )}
                <p className="mt-1 text-xs text-muted-foreground">{t("pickupLocation.privacyHint")}</p>
              </div>
            )}

            {(form.deliveryMethod === "PICKUP" || form.deliveryMethod === "BOTH") && (
              <div className="mb-4 space-y-2 rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold text-foreground">{t("pickupPayment.title")}</h3>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.allowPlatformPickup}
                    onChange={(e) => updateField("allowPlatformPickup", e.target.checked)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                      <span>{t("pickupPayment.platform.label")}</span>
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                        {t("pickupPayment.platform.badge")}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t("pickupPayment.platform.hint")}</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.allowExternalPickup}
                    onChange={(e) => updateField("allowExternalPickup", e.target.checked)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                      <span>{t("pickupPayment.external.label")}</span>
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                        {t("pickupPayment.external.badge")}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t("pickupPayment.external.hint")}</p>
                  </div>
                </label>
                {!form.allowPlatformPickup && !form.allowExternalPickup && (
                  <p className="text-xs text-red-500">{t("pickupPayment.atLeastOne")}</p>
                )}
              </div>
            )}

            {(form.deliveryMethod === "SHIP" || form.deliveryMethod === "BOTH") && (
              <div className="mt-6 border-t border-border pt-6">
                <h3 className="text-sm font-semibold text-foreground mb-1">{t("selectShippingMethods")}</h3>
                <p className="text-xs text-muted-foreground mb-3">{t("selectShippingMethodsHint")}</p>
                <ShippingMethodDisplay
                  methods={shippingMethods}
                  listingType={form.listingType}
                  price={form.price}
                  allowMailbox={form.allowMailbox}
                  onAllowMailboxChange={(next) => updateField("allowMailbox", next)}
                  freeShipping={form.freeShipping}
                  originCountry={originCountry}
                  neighbors={neighbors}
                />
              </div>
            )}

            {/* Gratis-verzending toggle alleen relevant voor SHIP en BOTH —
                bij alleen PICKUP wordt er sowieso niet verzonden. */}
            {(form.deliveryMethod === "SHIP" || form.deliveryMethod === "BOTH") && (
              <div className="flex items-center justify-between glass-subtle rounded-xl p-4 mt-4">
                <div>
                  <span className="text-sm font-medium text-foreground">{t("freeShipping")}</span>
                  {form.freeShipping && (
                    <p className="text-xs text-muted-foreground mt-0.5">{t("freeShippingNote")}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => updateField("freeShipping", !form.freeShipping)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${form.freeShipping ? "bg-primary" : "bg-muted"}`}
                >
                  <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.freeShipping ? "translate-x-5" : ""}`} />
                </button>
              </div>
            )}
          </section>

          {/* Section 6: Promotie (Spotlight + Category Highlight + Labels) */}
          <section data-section="promotion" className="glass rounded-2xl p-6 scroll-mt-32">
            <StepUpsells
              upsells={form.upsells}
              labels={form.labels}
              userBalance={userBalance}
              accountType={userAccountType}
              freeUpsellsRemaining={freeUpsellsRemaining}
              listingType={form.listingType}
              condition={form.condition || null}
              onUpsellsChange={(v) => updateField("upsells", v)}
              onLabelsChange={(v) => updateField("labels", v)}
            />
          </section>
        </div>

        {/* Sticky samenvatting (lg+) */}
        <div className="hidden lg:block">
          <ListingFormSummary
            listingType={form.listingType}
            images={form.images}
            title={form.title}
            description={form.description}
            cardName={form.cardName}
            condition={form.condition}
            conditionRange={form.conditionRange}
            productType={form.productType}
            itemCategory={form.itemCategory}
            pricingType={form.pricingType as "FIXED" | "NEGOTIABLE"}
            price={form.price}
            suggestedPrice={form.suggestedPrice}
            deliveryMethod={form.deliveryMethod}
            pickupCity={userCity}
            upsellsCount={form.upsells.length}
            labelsCount={form.labels.length}
          />
        </div>
      </div>

      {/* Submit bar — chip-array missing fields + preview-knop. */}
      <div className="sticky bottom-4 z-10 mt-8">
        <div className="glass rounded-2xl p-4 flex flex-col items-center gap-3 shadow-lg sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
            {missing.length === 0 ? (
              <span className="text-sm text-emerald-700 dark:text-emerald-300">{t("readyToPreview")}</span>
            ) : (
              missing.map((m) => (
                <span
                  key={m.key}
                  className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                >
                  {m.label}
                </span>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setShowPreview(true);
              if (typeof window !== "undefined") {
                window.scrollTo({ top: 0, behavior: "instant" });
              }
            }}
            disabled={!isReadyToPublish}
            className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-primary-hover hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <Eye className="h-4 w-4" />
            {t("preview")}
          </button>
        </div>
      </div>
    </div>
  );
}
