"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Lock, Mailbox, Package, ShieldCheck, Info } from "lucide-react";
import { KNOWN_CARRIERS } from "@/lib/shipping/carriers";
import { CarrierLogo } from "@/components/ui/carrier-logo";
import { Link } from "@/i18n/navigation";
import { mailboxEligibleType } from "@/lib/listing-types";
import type { EnrichedShippingMethod } from "@/components/ui/shipping-method-selector";

const MAILBOX_BLOCKED_PRICE = 150;

const SERVICE_ORDER: Record<string, number> = {
  MAILBOX_PARCEL: 0,
  PARCEL_STANDARD: 1,
  PARCEL_SIGNED: 2,
};

const SERVICE_ICONS = {
  MAILBOX_PARCEL: Mailbox,
  PARCEL_STANDARD: Package,
  PARCEL_SIGNED: ShieldCheck,
} as const;

interface Props {
  methods: EnrichedShippingMethod[];
  listingType: string;
  price: number | null;
  allowMailbox: boolean;
  onAllowMailboxChange: (next: boolean) => void;
  freeShipping?: boolean;
  /** Override van de mailbox-toggle-hint (bv. claimsales: brievenbus staat default aan). */
  mailboxHint?: string;
}

/**
 * Verzendmethode-display voor de listing/auction-form (post-Fase-33 v2).
 *
 * Standaard- en Aangetekend pakket zijn altijd inbegrepen op basis van de
 * actieve seller-slots — niet aanpasbaar per listing. De seller beheert die
 * via /dashboard/verzending. Brievenbuspakket is opt-in per listing en alleen
 * beschikbaar voor SINGLE_CARD/MULTI_CARD types onder €150 (anti-fraude).
 */
export function ShippingMethodDisplay({
  methods,
  listingType,
  price,
  allowMailbox,
  onAllowMailboxChange,
  freeShipping = false,
  mailboxHint,
}: Props) {
  const t = useTranslations("shipping");
  const tListing = useTranslations("listing");

  const activeMethods = methods.filter((m) => m.isActive);

  const mailboxEligible = mailboxEligibleType(listingType);
  const mailboxBlocked = price !== null && price >= MAILBOX_BLOCKED_PRICE;

  // Auto-uitschakelen bij price-transitie naar ≥€150 of bij type-wissel
  // naar een mailbox-incompatibel type. Voorkomt server-rejection later.
  useEffect(() => {
    if (allowMailbox && (mailboxBlocked || !mailboxEligible)) {
      onAllowMailboxChange(false);
    }
  }, [allowMailbox, mailboxBlocked, mailboxEligible, onAllowMailboxChange]);

  if (activeMethods.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        <p>{t("noMethodsConfigured")}</p>
        <Link
          href="/dashboard/verzending"
          className="mt-2 inline-block text-primary hover:underline"
        >
          {t("methodsManageLink")}
        </Link>
      </div>
    );
  }

  // Heeft de seller MAILBOX-slots ingesteld? Indien nee: geen toggle tonen.
  const hasMailboxSlot = activeMethods.some((m) => m.service === "MAILBOX_PARCEL");

  // Sorteer: MAILBOX_PARCEL → PARCEL_STANDARD → PARCEL_SIGNED, dan per zone.
  const sortedMethods = [...activeMethods].sort((a, b) => {
    const sa = SERVICE_ORDER[a.service] ?? 99;
    const sb = SERVICE_ORDER[b.service] ?? 99;
    if (sa !== sb) return sa - sb;
    return (a.zone || "").localeCompare(b.zone || "");
  });

  function getCarrierName(carrierId: string) {
    return KNOWN_CARRIERS.find((c) => c.id === carrierId)?.name ?? carrierId;
  }

  return (
    <div className="space-y-3">
      {/* Brievenbuspakket-toggle — alleen voor SINGLE/MULTI types waar de seller
          ook een MAILBOX-slot heeft staan. */}
      {mailboxEligible && hasMailboxSlot && (
        <label
          className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
            mailboxBlocked
              ? "cursor-not-allowed border-border bg-muted/30 opacity-70"
              : "cursor-pointer border-border hover:bg-muted/30"
          }`}
        >
          <input
            type="checkbox"
            checked={allowMailbox && !mailboxBlocked}
            disabled={mailboxBlocked}
            onChange={(e) => onAllowMailboxChange(e.target.checked)}
            className="mt-0.5 rounded border-border"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Mailbox className="h-4 w-4" />
              {tListing("shippingDisplay.mailboxToggle")}
              {mailboxBlocked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {mailboxBlocked
                ? tListing("shippingDisplay.mailboxBlockedAt150")
                : (mailboxHint ?? tListing("shippingDisplay.mailboxHint"))}
            </p>
          </div>
        </label>
      )}

      {/* Alle ingestelde methoden van de seller — alleen MAILBOX is toggleable.
          STANDARD en SIGNED zijn altijd actief in de gekozen scope. */}
      <div className="space-y-2">
        {sortedMethods.map((method) => {
          const Icon = SERVICE_ICONS[method.service as keyof typeof SERVICE_ICONS] ?? Package;
          const isMailbox = method.service === "MAILBOX_PARCEL";
          const isMailboxActive = isMailbox && allowMailbox && !mailboxBlocked && mailboxEligible;
          const isLocked = !isMailbox; // STANDARD + SIGNED altijd locked-included

          // MAILBOX-rijen worden alleen ter info getoond; toggle staat los
          // hierboven. Mailbox-rij dimmen als toggle uit staat zodat de seller
          // ziet dat de slot bestaat maar nu niet wordt aangeboden.
          const isDim = isMailbox && !isMailboxActive;

          return (
            <div
              key={method.id}
              className={`flex items-start gap-3 rounded-xl border p-3 ${
                isDim
                  ? "border-dashed border-border bg-muted/20 opacity-60"
                  : "border-border bg-card"
              }`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <CarrierLogo carrierId={method.carrier} size={16} />
                    <span>
                      {getCarrierName(method.carrier)} — {t(`service.${method.service}`)}
                    </span>
                    {isLocked && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        <Lock className="h-3 w-3" />
                        {tListing("shippingDisplay.alwaysIncluded")}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-primary">
                    {freeShipping ? (
                      <span className="text-green-600 dark:text-green-400">{t("free")}</span>
                    ) : (
                      <>€{method.effectivePrice.toFixed(2)}</>
                    )}
                  </p>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{t(`zone.${method.zone}`)}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{tListing("shippingDisplay.lockedNote")}</span>
      </div>
    </div>
  );
}
