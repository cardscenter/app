"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState, useRef, useEffect, useTransition } from "react";
import { createAuction } from "@/actions/auction";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Eye } from "lucide-react";
import type { SellerShippingMethod } from "@prisma/client";
import type { AuctionType, UpsellType } from "@/types";

import { StepType } from "./steps/step-type";
import { StepPhotos } from "./steps/step-photos";
import { StepDetails } from "./steps/step-details";
import { StepPricing } from "./steps/step-pricing";
import { StepUpsells } from "./steps/step-upsells";
import { AuctionPreview } from "./steps/step-review";
import { ShippingMethodSelector } from "@/components/ui/shipping-method-selector";

interface UpsellEntry {
  type: UpsellType;
  days: number;
}

interface FormState {
  auctionType: AuctionType;
  images: string[];
  title: string;
  description: string;
  cardName: string;
  condition: string;
  estimatedCardCount: number | null;
  conditionRange: string;
  productType: string;
  itemCategory: string;
  startingBid: number | null;
  duration: number;
  hasReserve: boolean;
  reservePrice: number | null;
  hasBuyNow: boolean;
  buyNowPrice: number | null;
  selectedShippingMethods: string[];
  upsells: UpsellEntry[];
}

const INITIAL_STATE: FormState = {
  auctionType: "SINGLE_CARD",
  images: [],
  title: "",
  description: "",
  cardName: "",
  condition: "Near Mint",
  estimatedCardCount: null,
  conditionRange: "",
  productType: "",
  itemCategory: "",
  startingBid: null,
  duration: 7,
  hasReserve: false,
  reservePrice: null,
  hasBuyNow: false,
  buyNowPrice: null,
  selectedShippingMethods: [],
  upsells: [],
};

interface MultiStepAuctionFormProps {
  shippingMethods: SellerShippingMethod[];
  userBalance: number;
  accountType: string;
}

export function MultiStepAuctionForm({ shippingMethods, userBalance, accountType }: MultiStepAuctionFormProps) {
  const t = useTranslations("auction");
  const ts = useTranslations("shipping");
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [showPreview, setShowPreview] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();

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

    if (form.cardName) formData.set("cardName", form.cardName);
    if (form.condition) formData.set("condition", form.condition);
    if (form.estimatedCardCount !== null) formData.set("estimatedCardCount", String(form.estimatedCardCount));
    if (form.conditionRange) formData.set("conditionRange", form.conditionRange);
    if (form.productType) formData.set("productType", form.productType);
    if (form.itemCategory) formData.set("itemCategory", form.itemCategory);
    if (form.hasReserve && form.reservePrice !== null) formData.set("reservePrice", String(form.reservePrice));
    if (form.hasBuyNow && form.buyNowPrice !== null) formData.set("buyNowPrice", String(form.buyNowPrice));
    if (form.selectedShippingMethods.length === 0) {
      toast.error(ts("selectAtLeastOneMethod"));
      return;
    }
    formData.set("shippingMethodIds", JSON.stringify(form.selectedShippingMethods));
    if (form.upsells.length > 0) formData.set("upsells", JSON.stringify(form.upsells));

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
        <StepType value={form.auctionType} onChange={(v) => updateField("auctionType", v)} />
      </section>

      {/* Section 2: Photos */}
      <section className="glass rounded-2xl p-6">
        <StepPhotos auctionType={form.auctionType} images={form.images} onChange={(v) => updateField("images", v)} />
      </section>

      {/* Section 3: Details */}
      <section className="glass rounded-2xl p-6">
        <StepDetails
          auctionType={form.auctionType}
          title={form.title}
          description={form.description}
          cardName={form.cardName}
          condition={form.condition}
          estimatedCardCount={form.estimatedCardCount}
          conditionRange={form.conditionRange}
          productType={form.productType}
          itemCategory={form.itemCategory}
          onChange={updateField}
        />
      </section>

      {/* Section 4: Pricing & Duration */}
      <section className="glass rounded-2xl p-6">
        <StepPricing
          startingBid={form.startingBid}
          duration={form.duration}
          hasReserve={form.hasReserve}
          reservePrice={form.reservePrice}
          hasBuyNow={form.hasBuyNow}
          buyNowPrice={form.buyNowPrice}
          onChange={updateField}
        />
      </section>

      {/* Section 5: Shipping Methods */}
      <section className="glass rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">{ts("selectShippingMethods")}</h2>
        <p className="text-sm text-muted-foreground mb-4">{ts("selectShippingMethodsHint")}</p>
        <ShippingMethodSelector
          methods={shippingMethods.filter((m) => m.shippingType !== "LETTER")}
          selected={form.selectedShippingMethods}
          onChange={(v) => updateField("selectedShippingMethods", v)}
        />
      </section>

      {/* Section 6: Upsells */}
      <section className="glass rounded-2xl p-6">
        <StepUpsells
          upsells={form.upsells}
          userBalance={userBalance}
          accountType={accountType}
          onChange={(v) => updateField("upsells", v)}
        />
      </section>

      {/* Submit bar — preview button */}
      <div className="sticky bottom-4 z-10">
        <div className="glass rounded-2xl p-4 flex items-center justify-between shadow-lg">
          <div className="text-sm text-muted-foreground">
            {form.images.length === 0 && (
              <span className="text-amber-600 dark:text-amber-400">{t("photoRequired")}</span>
            )}
            {form.images.length > 0 && !form.title && (
              <span className="text-amber-600 dark:text-amber-400">{t("titleRequired")}</span>
            )}
            {form.images.length > 0 && form.title && !form.startingBid && (
              <span className="text-amber-600 dark:text-amber-400">{t("startingBidRequired")}</span>
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
