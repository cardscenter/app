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
  const ts = useTranslations("shipping");

  // mailboxEligibleType() accepteert MULTI_CARD → mailbox-toggle zichtbaar voor
  // kaarten-claimsales; ITEMS gedraagt zich als OTHER (geen brievenbus).
  const shippingListingType = type === "CARDS" ? "MULTI_CARD" : "OTHER";

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{t("stepVerzending")}</h2>
      <p className="text-sm text-muted-foreground">{ts("selectShippingMethodsHint")}</p>
      <ShippingMethodDisplay
        methods={shippingMethods}
        listingType={shippingListingType}
        price={maxItemPrice}
        allowMailbox={allowMailbox}
        onAllowMailboxChange={onAllowMailboxChange}
      />
    </div>
  );
}
