"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState, useRef, useEffect, useTransition } from "react";
import { createClaimsale } from "@/actions/claimsale";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Eye } from "lucide-react";
import type { EnrichedShippingMethod } from "@/components/ui/shipping-method-selector";

import { StepBasis } from "./steps/step-basis";
import { StepInhoud } from "./steps/step-inhoud";
import { StepVerzending } from "./steps/step-verzending";
import { StepPromotie } from "./steps/step-promotie";
import { StepTiming } from "./steps/step-timing";
import { ClaimsalePreview } from "./steps/step-review";
import { ClaimsaleFormProgress, type ClaimsaleStepKey } from "./claimsale-form-progress";
import { ClaimsaleFormSummary } from "./claimsale-form-summary";
import {
  type ClaimsaleFormState,
  type ClaimsaleType,
  type ClaimsaleItemDraft,
  makeEmptyCardItem,
  makeEmptyProductItem,
} from "./wizard-types";

interface MultiStepClaimsaleFormProps {
  maxItems: number;
  shippingMethods: EnrichedShippingMethod[];
  userBalance: number;
  accountType: string;
  freeUpsellsRemaining?: number;
}

function initialState(): ClaimsaleFormState {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return {
    type: "CARDS",
    coverImage: null,
    title: "",
    description: "",
    items: [makeEmptyCardItem()],
    // CARDS: brievenbuspakket standaard aan (kaarten passen makkelijk in een
    // brievenbus). ITEMS: niet van toepassing.
    allowMailbox: true,
    startDate: d,
    startTimeOfDay: "09:00",
    upsells: [],
    labels: [],
  };
}

export function MultiStepClaimsaleForm({
  maxItems,
  shippingMethods,
  userBalance,
  accountType,
  freeUpsellsRemaining = 0,
}: MultiStepClaimsaleFormProps) {
  const t = useTranslations("claimsale");
  const router = useRouter();
  const [form, setForm] = useState<ClaimsaleFormState>(initialState);
  const [showPreview, setShowPreview] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();

  const [actionState, formAction, pending] = useActionState(
    async (
      _prev: { error?: string; success?: boolean; claimsaleId?: string } | null | undefined,
      formData: FormData
    ) => {
      const result = await createClaimsale(formData);
      return result ?? null;
    },
    null
  );

  useEffect(() => {
    const state = actionState as { success?: boolean; claimsaleId?: string } | null;
    if (state?.success && state.claimsaleId) {
      router.push("/claimsales?created=1");
    }
  }, [actionState, router]);

  const updateField = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const onItemsChange = (items: ClaimsaleItemDraft[]) => {
    setForm((prev) => ({ ...prev, items }));
  };

  const onTypeChange = (next: ClaimsaleType) => {
    setForm((prev) => ({
      ...prev,
      type: next,
      // Items wissen — CARDS- en ITEMS-velden verschillen te veel om te behouden.
      items: [next === "CARDS" ? makeEmptyCardItem() : makeEmptyProductItem()],
      // Brievenbuspakket is alleen voor CARDS — bij ITEMS uit, bij CARDS default aan.
      allowMailbox: next === "CARDS",
      labels: [],
    }));
  };

  const prices = form.items
    .map((i) => parseFloat(i.price))
    .filter((p) => !Number.isNaN(p) && p > 0);
  const hasMintItem =
    form.type === "CARDS" &&
    form.items.some((i) => i.condition === "Near Mint" || i.condition === "Mint");

  const handleSubmit = () => {
    const itemsWithPrice = form.items.filter((i) => parseFloat(i.price) > 0);
    if (itemsWithPrice.length === 0) {
      toast.error(t("needOneItem"));
      return;
    }

    const formData = new FormData();
    formData.set("title", form.title);
    formData.set("description", form.description);
    if (form.coverImage) formData.set("coverImage", form.coverImage);
    formData.set("type", form.type);
    formData.set("allowMailbox", String(form.allowMailbox));
    formData.set("startDate", form.startDate.toISOString());
    formData.set("startTimeOfDay", form.startTimeOfDay);

    const itemsPayload = itemsWithPrice.map((i, idx) => {
      if (form.type === "CARDS") {
        const imageUrls: string[] = [];
        if (i.frontImage) imageUrls.push(i.frontImage);
        if (i.backImage) imageUrls.push(i.backImage);
        if (imageUrls.length === 0 && i.tcgdex?.imageUrl) imageUrls.push(i.tcgdex.imageUrl);
        const baseName = i.cardName || i.tcgdex?.name || `Kaart ${idx + 1}`;
        const needsReverseSuffix = i.variant === "reverse" && !/reverse/i.test(baseName);
        const cardName = needsReverseSuffix ? `${baseName} (Reverse Holo)` : baseName;
        return {
          cardName,
          cardNumber: i.cardNumber || i.tcgdex?.localId || undefined,
          sellerNote: i.sellerNote || undefined,
          condition: i.condition,
          price: parseFloat(i.price),
          imageUrls,
          tcgdexId: i.tcgdex?.id || undefined,
        };
      }
      return {
        cardName: i.itemName || `Item ${idx + 1}`,
        itemDescription: i.itemDescription || undefined,
        sellerNote: i.sellerNote || undefined,
        condition: i.condition,
        price: parseFloat(i.price),
        imageUrls: i.itemImages,
      };
    });
    formData.set("items", JSON.stringify(itemsPayload));

    if (form.upsells.length > 0) formData.set("upsells", JSON.stringify(form.upsells));
    if (form.labels.length > 0) formData.set("labels", JSON.stringify(form.labels));

    startTransition(() => {
      formAction(formData);
    });
  };

  if (showPreview) {
    return (
      <ClaimsalePreview
        form={form}
        onBack={() => setShowPreview(false)}
        onPublish={handleSubmit}
        pending={pending}
        error={actionState?.error}
        accountType={accountType}
        freeUpsellsRemaining={freeUpsellsRemaining}
      />
    );
  }

  const completedSteps = new Set<ClaimsaleStepKey>();
  if (form.title.length >= 3) completedSteps.add("basis");
  if (prices.length > 0) completedSteps.add("inhoud");
  completedSteps.add("verzending");
  completedSteps.add("promotie");
  completedSteps.add("timing");

  const missing: { key: string; label: string }[] = [];
  if (form.title.length < 3) missing.push({ key: "title", label: t("titleRequired") });
  if (prices.length === 0) missing.push({ key: "items", label: t("itemsRequired") });

  return (
    <div ref={topRef}>
      <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-8">
        <div className="space-y-8">
          <ClaimsaleFormProgress completed={completedSteps} />

          {actionState?.error && (
            <div className="glass-subtle rounded-2xl bg-red-50/50 p-4 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
              {actionState.error}
            </div>
          )}

          <section data-section="basis" className="glass rounded-2xl p-6 scroll-mt-32">
            <StepBasis
              type={form.type}
              coverImage={form.coverImage}
              title={form.title}
              description={form.description}
              hasItems={form.items.some(
                (i) => i.price || i.cardName || i.itemName || i.tcgdex || i.frontImage
              )}
              onChange={updateField}
              onTypeChange={onTypeChange}
            />
          </section>

          <section data-section="inhoud" className="glass rounded-2xl p-6 scroll-mt-32">
            <StepInhoud
              type={form.type}
              items={form.items}
              maxItems={maxItems}
              onItemsChange={onItemsChange}
            />
          </section>

          <section data-section="verzending" className="glass rounded-2xl p-6 scroll-mt-32">
            <StepVerzending
              type={form.type}
              shippingMethods={shippingMethods}
              allowMailbox={form.allowMailbox}
              onAllowMailboxChange={(next) => updateField("allowMailbox", next)}
            />
          </section>

          <section data-section="promotie" className="glass rounded-2xl p-6 scroll-mt-32">
            <StepPromotie
              upsells={form.upsells}
              labels={form.labels}
              userBalance={userBalance}
              accountType={accountType}
              freeUpsellsRemaining={freeUpsellsRemaining}
              claimsaleType={form.type}
              hasMintItem={hasMintItem}
              onUpsellsChange={(v) => updateField("upsells", v)}
              onLabelsChange={(v) => updateField("labels", v)}
            />
          </section>

          <section data-section="timing" className="glass rounded-2xl p-6 scroll-mt-32">
            <StepTiming
              startDate={form.startDate}
              startTimeOfDay={form.startTimeOfDay}
              onChange={updateField}
            />
          </section>
        </div>

        <div className="hidden lg:block">
          <ClaimsaleFormSummary form={form} />
        </div>
      </div>

      <div className="sticky bottom-4 z-10 mt-8">
        <div className="glass flex flex-col items-center gap-3 rounded-2xl p-4 shadow-lg sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
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
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
            disabled={form.title.length < 3 || prices.length === 0}
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
