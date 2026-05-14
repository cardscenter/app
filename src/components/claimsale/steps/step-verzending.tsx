"use client";

import { useTranslations } from "next-intl";
import { ShippingMethodDisplay } from "@/components/listing/shipping-method-display";
import type { EnrichedShippingMethod } from "@/components/ui/shipping-method-selector";
import type { ClaimsaleType } from "../wizard-types";

interface StepVerzendingProps {
  type: ClaimsaleType;
  shippingMethods: EnrichedShippingMethod[];
  maxItemPrice: number | null;
  allowMailbox: boolean;
  onAllowMailboxChange: (next: boolean) => void;
}

export function StepVerzending({
  type,
  shippingMethods,
  maxItemPrice,
  allowMailbox,
  onAllowMailboxChange,
}: StepVerzendingProps) {
  const t = useTranslations("claimsale");

  // CARDS: brievenbuspakket (standaard aan, <€150) + aangetekend pakket.
  //        Standaard pakket is niet nodig — kaarten passen in een brievenbus.
  // ITEMS: standaard pakket + aangetekend pakket. Geen brievenbus.
  const filteredMethods = shippingMethods.filter((m) => {
    if (m.service === "PARCEL_SIGNED") return true;
    if (m.service === "PARCEL_STANDARD") return type === "ITEMS";
    if (m.service === "MAILBOX_PARCEL") return type === "CARDS";
    return false;
  });

  // listingType="MULTI_CARD" maakt de brievenbus-toggle zichtbaar voor CARDS;
  // "OTHER" verbergt 'm voor ITEMS.
  const shippingListingType = type === "CARDS" ? "MULTI_CARD" : "OTHER";

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{t("stepVerzending")}</h2>
      <p className="text-sm text-muted-foreground">
        {type === "CARDS" ? t("verzendingCardsHint") : t("verzendingItemsHint")}
      </p>
      <ShippingMethodDisplay
        methods={filteredMethods}
        listingType={shippingListingType}
        price={maxItemPrice}
        allowMailbox={allowMailbox}
        onAllowMailboxChange={onAllowMailboxChange}
      />
    </div>
  );
}
