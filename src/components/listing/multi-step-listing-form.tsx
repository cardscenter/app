"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState, useRef, useEffect, useMemo } from "react";
import { createListing } from "@/actions/listing";
import { Link, useRouter } from "@/i18n/navigation";
import { Eye, Check, AlertCircle, Sparkles } from "lucide-react";
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
import { mailboxEligibleType } from "@/lib/listing-types";
import type { CardSearchSelectValue } from "@/components/ui/card-search-select";

type SeriesWithSets = Series & { cardSets: CardSet[] };

interface UpsellEntry {
  type: UpsellType;
  days: number;
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
  // Brievenbuspakket opt-in (Fase 33 v2). Standaard+Aangetekend zijn altijd
  // inbegrepen, alleen MAILBOX_PARCEL is per listing toggleable. Forced uit
  // bij prijs ≥€150 en bij niet-eligible types (COLLECTION/SEALED/OTHER).
  allowMailbox: boolean;
  upsells: UpsellEntry[];
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
  allowExternalPickup: true,
  deliveryMethod: "SHIP",
  freeShipping: false,
  shippingCost: 0,
  carriers: [],
  packageSize: "",
  packageCount: 1,
  stockQuantity: 1,
  allowMailbox: false,
  upsells: [],
};

// Sectie-IDs gebruikt voor voortgang en sectie-koppen.
type SectionId = "type" | "photos" | "details" | "pricing" | "shipping" | "upsells";

// Eén required-rule. `section` bepaalt welke sectie-kop een waarschuwing krijgt.
type Requirement = { key: string; messageKey: string; section: SectionId; profileLink?: boolean };

// Bouw de complete checklist in dezelfde volgorde als de form. De eerste
// niet-vervulde regel is de "next required step" die in de sticky bar staat.
function buildRequirements(
  form: FormState,
  userCity: string | null,
  shippingMethodsAvailable: number,
): Requirement[] {
  const reqs: Requirement[] = [];

  // 1. Foto's
  if (form.images.length === 0) {
    reqs.push({ key: "photos", messageKey: "photoRequired", section: "photos" });
  }

  // 2. Titel (min 3 chars na trim)
  if (form.title.trim().length < 3) {
    reqs.push({ key: "title", messageKey: "titleRequired", section: "details" });
  }

  // 3. Beschrijving (min 10 chars text, niet inclusief HTML-tags)
  const descText = form.description.replace(/<[^>]*>/g, "").trim();
  if (descText.length < 10) {
    reqs.push({ key: "description", messageKey: "descriptionRequired", section: "details" });
  }

  // 4. Type-specifieke verplichtingen
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

  // 5. Pricing
  if (form.pricingType === "FIXED" && (!form.price || form.price <= 0)) {
    reqs.push({ key: "price", messageKey: "priceRequired", section: "pricing" });
  }
  if (form.pricingType === "FIXED" && !form.allowDirectBuy && !form.acceptsOffers) {
    reqs.push({ key: "buyOptions", messageKey: "buyOptionsRequired", section: "pricing" });
  }

  // 6. Shipping & pickup
  const isPickup = form.deliveryMethod === "PICKUP" || form.deliveryMethod === "BOTH";
  const isShip = form.deliveryMethod === "SHIP" || form.deliveryMethod === "BOTH";

  if (isPickup && !userCity) {
    reqs.push({ key: "pickupCity", messageKey: "pickupCityRequired", section: "shipping", profileLink: true });
  }
  if (isPickup && !form.allowPlatformPickup && !form.allowExternalPickup) {
    reqs.push({ key: "pickupPayment", messageKey: "pickupPaymentRequired", section: "shipping" });
  }
  // SHIP zonder seller-shipping-config is niet bruikbaar — koper kan niet
  // checkouten. STANDARD+SIGNED zijn altijd inbegrepen, dus we checken alleen
  // dat seller überhaupt actieve methoden heeft.
  if (isShip && shippingMethodsAvailable === 0) {
    reqs.push({
      key: "shippingMethod",
      messageKey: "shippingMethodNoneAvailable",
      section: "shipping",
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
}

// Sectie-status indicator: groen vinkje voor afgeronde verplichte secties,
// amber voor verplichte secties met openstaand werk, en blauwe "Optioneel"
// pill voor secties die helemaal niet ingevuld hoeven te worden (zoals upsells).
function SectionHeader({
  title,
  status,
}: {
  title: string;
  status: "complete" | "incomplete" | "optional";
}) {
  const t = useTranslations("listing");
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {status === "complete" && (
        <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          <Check className="h-3.5 w-3.5" />
          {t("sectionComplete")}
        </span>
      )}
      {status === "incomplete" && (
        <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          <AlertCircle className="h-3.5 w-3.5" />
          {t("sectionIncomplete")}
        </span>
      )}
      {status === "optional" && (
        <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
          <Sparkles className="h-3.5 w-3.5" />
          {t("sectionOptional")}
        </span>
      )}
    </div>
  );
}

export function MultiStepListingForm({ seriesList, userBalance, userAccountType, freeUpsellsRemaining = 0, userCity = null, shippingMethods = [] }: MultiStepListingFormProps) {
  const t = useTranslations("listing");
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [showPreview, setShowPreview] = useState(false);
  const isPremium = userAccountType !== "FREE"; // For backward compat references
  const topRef = useRef<HTMLDivElement>(null);

  // Effectieve verzendmethode-ids voor server-snapshot: STANDARD+SIGNED altijd,
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

  // Redirect on successful listing creation
  useEffect(() => {
    if (actionState && "success" in actionState && actionState.success && actionState.listingId) {
      router.push(`/marktplaats/${actionState.listingId}`);
    }
  }, [actionState, router]);

  // Bij server-error: scroll terug naar de top zodat de fout zichtbaar wordt.
  // Belangrijk voor lange forms waar de submit-bar onderaan niet bij de error zit.
  useEffect(() => {
    if (actionState?.error) {
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [actionState?.error]);

  const updateField = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Centrale checklist — alle openstaande verplichte velden in volgorde.
  // De eerste regel is de "next required step" voor de sticky bar.
  const requirements = useMemo(
    () => buildRequirements(form, userCity, shippingMethods.filter((m) => m.isActive).length),
    [form, userCity, shippingMethods]
  );
  const nextRequirement = requirements[0];
  const isReadyToPublish = requirements.length === 0;

  // Per-sectie status — bepaalt het vinkje of de waarschuwing in de kop.
  const sectionStatus = (id: SectionId): "complete" | "incomplete" =>
    requirements.some((r) => r.section === id) ? "incomplete" : "complete";

  // Build FormData uit huidige form-state. Hergebruikt door zowel publish als save-draft.
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
    if (form.tcgdex?.id) formData.set("tcgdexId", form.tcgdex.id);
    if (form.price !== null) formData.set("price", String(form.price));
    // shippingMethodIds wordt server-side afgeleid via deriveListingShippingMethodIds.
    // We sturen alleen `allowMailbox` mee — de server vult STANDARD+SIGNED altijd in,
    // en MAILBOX alleen als de regels passen (type-eligible + price < €150).
    formData.set("allowMailbox", String(form.allowMailbox));
    if (form.carriers.length > 0) formData.set("carriers", JSON.stringify(form.carriers));
    if (form.packageSize) formData.set("packageSize", form.packageSize);
    if (form.productType) formData.set("productType", form.productType);
    if (form.itemCategory) formData.set("itemCategory", form.itemCategory);
    if (form.listingType === "SEALED_PRODUCT" || form.listingType === "OTHER") {
      formData.set("stockQuantity", String(Math.max(1, form.stockQuantity)));
    }
    if (form.upsells.length > 0) formData.set("upsells", JSON.stringify(form.upsells));
    // Koop-toggles + vraagprijs (Fase 27.31)
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

  // Preview modal
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
    <div ref={topRef} className="space-y-8">
      {/* Error message */}
      {actionState?.error && (
        <div className="glass-subtle rounded-2xl bg-red-50/50 p-4 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {actionState.error}
        </div>
      )}

      {/* Section 1: Type — altijd compleet (heeft een default) */}
      <section className="glass rounded-2xl p-6">
        <StepType value={form.listingType} onChange={(v) => updateField("listingType", v)} />
      </section>

      {/* Section 2: Photos */}
      <section className="glass rounded-2xl p-6">
        <SectionHeader title={t("photos")} status={sectionStatus("photos")} />
        <StepPhotos listingType={form.listingType} images={form.images} onChange={(v) => updateField("images", v)} />
      </section>

      {/* Section 3: Details (title, description, type-specific fields) */}
      <section className="glass rounded-2xl p-6">
        <SectionHeader title={t("stepDetails")} status={sectionStatus("details")} />
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
      <section className="glass rounded-2xl p-6">
        <SectionHeader title={t("stepPricing")} status={sectionStatus("pricing")} />
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

      {/* Section 5: Shipping + Pickup */}
      <section className="glass rounded-2xl p-6">
        <SectionHeader title={t("stepShipping")} status={sectionStatus("shipping")} />
        <p className="text-sm text-muted-foreground mb-4">{t("shippingMethodsHint")}</p>

        {/* Delivery-method toggle (Fase 27) */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">{t("deliveryMethodLabel")}</label>
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
                {t(m === "SHIP" ? "deliveryShip" : m === "PICKUP" ? "deliveryPickup" : "deliveryBoth")}
              </button>
            ))}
          </div>
        </div>

        {/* Pickup-locatie (alleen bij PICKUP/BOTH) — read-only, gevuld uit
            User.city. Als er geen woonplaats bekend is: directe link naar profiel
            zodat de seller de stad kan invullen zonder de form te verlaten. */}
        {(form.deliveryMethod === "PICKUP" || form.deliveryMethod === "BOTH") && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground mb-1">{t("pickupLocation.label")}</label>
            {userCity ? (
              <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground">
                {userCity}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <span>{t("pickupLocation.noCityWarning")}</span>
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

        {/* Pickup-betaal-modi (Fase 27.39) — seller bepaalt welke betaal-vormen
            koper mag kiezen bij ophalen. Alleen voor PICKUP/BOTH listings. */}
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
                <div className="text-sm font-medium text-foreground">{t("pickupPayment.platform.label")}</div>
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
                <div className="text-sm font-medium text-foreground">{t("pickupPayment.external.label")}</div>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("pickupPayment.external.hint")}</p>
              </div>
            </label>
            {!form.allowPlatformPickup && !form.allowExternalPickup && (
              <p className="text-xs text-red-500">{t("pickupPayment.atLeastOne")}</p>
            )}
          </div>
        )}

        {(form.deliveryMethod === "SHIP" || form.deliveryMethod === "BOTH") && (
          <ShippingMethodDisplay
            methods={shippingMethods}
            listingType={form.listingType}
            price={form.price}
            allowMailbox={form.allowMailbox}
            onAllowMailboxChange={(next) => updateField("allowMailbox", next)}
            freeShipping={form.freeShipping}
          />
        )}

        {/* Free shipping toggle */}
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
      </section>

      {/* Section 6: Upsells — altijd optioneel, krijgt blauwe pill */}
      <section className="glass rounded-2xl p-6">
        <SectionHeader title={t("stepUpsells")} status="optional" />
        <StepUpsells
          upsells={form.upsells}
          userBalance={userBalance}
          accountType={userAccountType}
          freeUpsellsRemaining={freeUpsellsRemaining}
          onChange={(v) => updateField("upsells", v)}
        />
      </section>

      {/* Submit bar — toont eerstvolgende verplichte stap. Preview-knop is uit
          zolang er nog iets ontbreekt (preview = ready-to-publish gate). */}
      <div className="sticky bottom-4 z-10">
        <div className="glass rounded-2xl p-4 flex flex-col gap-3 shadow-lg sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 text-sm">
            {isReadyToPublish ? (
              <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                <Check className="h-4 w-4" />
                {t("allFieldsComplete")}
              </span>
            ) : (
              <div className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="truncate">{nextRequirement && t(nextRequirement.messageKey)}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowPreview(true)}
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
