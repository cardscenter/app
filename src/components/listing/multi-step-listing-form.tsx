"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState, useRef, useEffect } from "react";
import { createListing } from "@/actions/listing";
import { useRouter } from "@/i18n/navigation";
import { Eye } from "lucide-react";
import type { Series, CardSet } from "@prisma/client";
import type { ListingType, DeliveryMethod, PackageSize, Carrier, UpsellType, CardItemEntry } from "@/types";

import { StepType } from "./steps/step-type";
import { StepPhotos } from "./steps/step-photos";
import { StepDetails } from "./steps/step-details";
import { StepPricing } from "./steps/step-pricing";
import { StepUpsells } from "./steps/step-upsells";
import { ShippingMethodSelector } from "@/components/ui/shipping-method-selector";
import type { SellerShippingMethod } from "@prisma/client";
import { ListingPreview } from "./steps/step-review";

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
  cardItems: CardItemEntry[];
  estimatedCardCount: number | null;
  productType: string;
  itemCategory: string;
  pricingType: string;
  price: number | null;
  deliveryMethod: DeliveryMethod;
  freeShipping: boolean;
  shippingCost: number;
  carriers: Carrier[];
  packageSize: PackageSize | "";
  packageCount: number;
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
  cardItems: [],
  estimatedCardCount: null,
  productType: "",
  itemCategory: "",
  pricingType: "FIXED",
  price: null,
  deliveryMethod: "SHIP",
  freeShipping: false,
  shippingCost: 0,
  carriers: [],
  packageSize: "",
  packageCount: 1,
  upsells: [],
};

interface MultiStepListingFormProps {
  seriesList: SeriesWithSets[];
  userBalance: number;
  userAccountType: string;
  shippingMethods?: SellerShippingMethod[];
}

export function MultiStepListingForm({ seriesList, userBalance, userAccountType, shippingMethods = [] }: MultiStepListingFormProps) {
  const t = useTranslations("listing");
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [selectedShippingMethods, setSelectedShippingMethods] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const isPremium = userAccountType !== "FREE"; // For backward compat references
  const topRef = useRef<HTMLDivElement>(null);

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

  const updateField = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
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

    if (form.cardName) formData.set("cardName", form.cardName);
    if (form.cardSetId) formData.set("cardSetId", form.cardSetId);
    if (form.condition) formData.set("condition", form.condition);
    if (form.price !== null) formData.set("price", String(form.price));
    if (selectedShippingMethods.length > 0) formData.set("shippingMethodIds", JSON.stringify(selectedShippingMethods));
    if (form.carriers.length > 0) formData.set("carriers", JSON.stringify(form.carriers));
    if (form.packageSize) formData.set("packageSize", form.packageSize);
    if (form.cardItems.length > 0) formData.set("cardItems", JSON.stringify(form.cardItems));
    if (form.estimatedCardCount !== null) formData.set("estimatedCardCount", String(form.estimatedCardCount));

    if (form.productType) formData.set("productType", form.productType);
    if (form.itemCategory) formData.set("itemCategory", form.itemCategory);
    if (form.upsells.length > 0) formData.set("upsells", JSON.stringify(form.upsells));

    formAction(formData);
  };

  // Preview modal
  if (showPreview) {
    return (
      <ListingPreview
        form={form}
        accountType={userAccountType}
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

      {/* Section 1: Type */}
      <section className="glass rounded-2xl p-6">
        <StepType value={form.listingType} onChange={(v) => updateField("listingType", v)} />
      </section>

      {/* Section 2: Photos */}
      <section className="glass rounded-2xl p-6">
        <StepPhotos listingType={form.listingType} images={form.images} onChange={(v) => updateField("images", v)} />
      </section>

      {/* Section 3: Details (title, description, type-specific fields) */}
      <section className="glass rounded-2xl p-6">
        <StepDetails
          listingType={form.listingType}
          seriesList={seriesList}
          title={form.title}
          description={form.description}
          cardName={form.cardName}
          cardSetId={form.cardSetId}
          selectedSeries={form.selectedSeries}
          condition={form.condition}
          cardItems={form.cardItems}
          estimatedCardCount={form.estimatedCardCount}

          productType={form.productType}
          itemCategory={form.itemCategory}
          onChange={updateField}
        />
      </section>

      {/* Section 4: Pricing */}
      <section className="glass rounded-2xl p-6">
        <StepPricing pricingType={form.pricingType} price={form.price} onChange={updateField} />
      </section>

      {/* Section 5: Shipping */}
      <section className="glass rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">{t("stepShipping")}</h2>
        <p className="text-sm text-muted-foreground mb-4">{t("shippingMethodsHint")}</p>

        <ShippingMethodSelector
          methods={shippingMethods}
          selected={selectedShippingMethods}
          onChange={setSelectedShippingMethods}
          context="listing"
        />

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

      {/* Section 6: Upsells */}
      <section className="glass rounded-2xl p-6">
        <StepUpsells
          upsells={form.upsells}
          userBalance={userBalance}
          accountType={userAccountType}
          onChange={(v) => updateField("upsells", v)}
        />
      </section>

      {/* Submit bar — only preview button, publish is in the preview */}
      <div className="sticky bottom-4 z-10">
        <div className="glass rounded-2xl p-4 flex items-center justify-between shadow-lg">
          <div className="text-sm text-muted-foreground">
            {form.images.length === 0 && (
              <span className="text-amber-600 dark:text-amber-400">{t("photoRequired")}</span>
            )}
            {form.images.length > 0 && !form.title && (
              <span className="text-amber-600 dark:text-amber-400">{t("titleRequired")}</span>
            )}
            {form.images.length > 0 && form.title && form.pricingType === "FIXED" && !form.price && (
              <span className="text-amber-600 dark:text-amber-400">{t("priceRequired")}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            disabled={form.images.length === 0}
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
