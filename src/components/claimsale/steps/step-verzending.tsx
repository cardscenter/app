"use client";

import { useTranslations } from "next-intl";
import { ShippingMethodDisplay } from "@/components/listing/shipping-method-display";
import type { EnrichedShippingMethod } from "@/components/ui/shipping-method-selector";
import type { ClaimsaleType } from "../wizard-types";

interface StepVerzendingProps {
  type: ClaimsaleType;
  shippingMethods: EnrichedShippingMethod[];
  allowMailbox: boolean;
  onAllowMailboxChange: (next: boolean) => void;
  originCountry?: string | null;
  neighbors?: string[];
}

export function StepVerzending({
  type,
  shippingMethods,
  allowMailbox,
  onAllowMailboxChange,
  originCountry = null,
  neighbors = [],
}: StepVerzendingProps) {
  const t = useTranslations("claimsale");

  // CARDS: brievenbuspakket (standaard aan, <€150) + aangetekend pakket. In
  //        het binnenland geen standaard pakket — kaarten gaan door de bus.
  //        Naar buurland / overige EU blijft standaard pakket wel beschikbaar
  //        (daar bestaat geen brievenbuspost).
  // ITEMS: standaard pakket + aangetekend pakket in alle zones. Geen brievenbus.
  const filteredMethods = shippingMethods.filter((m) => {
    if (m.service === "PARCEL_SIGNED") return true;
    if (m.service === "PARCEL_STANDARD") return type === "ITEMS" || m.zone !== "DOMESTIC";
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
      {/* price={null}: bij het aanmaken blokkeren we brievenbus niet op
          item-prijs. De €150-grens geldt per bestelling en wordt bij het
          afrekenen gecontroleerd. */}
      <ShippingMethodDisplay
        methods={filteredMethods}
        listingType={shippingListingType}
        price={null}
        allowMailbox={allowMailbox}
        onAllowMailboxChange={onAllowMailboxChange}
        mailboxHint={type === "CARDS" ? t("mailboxHintCards") : undefined}
        originCountry={originCountry}
        neighbors={neighbors}
      />
    </div>
  );
}
