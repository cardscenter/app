"use client";

import { useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Lock, Mailbox, Package, ShieldCheck, Info } from "lucide-react";
import { KNOWN_CARRIERS } from "@/lib/shipping/carriers";
import { CarrierLogo } from "@/components/ui/carrier-logo";
import { CountryFlag } from "@/components/ui/country-flag";
import { Link } from "@/i18n/navigation";
import { mailboxEligibleType } from "@/lib/listing-types";
import { getCountryName } from "@/lib/shipping/countries";
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
  /** Seller's eigen land (ISO 3166-1 alpha-2) voor de DOMESTIC-vlag in de zone-headers. */
  originCountry?: string | null;
  /** Lijst van EU_NEAR-buurland-codes voor de EU_NEAR-vlag(gen) in de zone-headers. */
  neighbors?: string[];
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
  originCountry,
  neighbors = [],
}: Props) {
  const t = useTranslations("shipping");
  const tListing = useTranslations("listing");
  const locale = useLocale();

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

  // Groepeer per zone (DOMESTIC → EU_NEAR → EU_FAR) en sorteer binnen elke
  // groep op service (MAILBOX → STANDARD → SIGNED). Zone-headers tonen
  // bijbehorende vlaggen — gemakkelijk te scannen voor verkopers.
  const ZONE_ORDER: Record<string, number> = { DOMESTIC: 0, EU_NEAR: 1, EU_FAR: 2 };
  const byZone: Record<string, EnrichedShippingMethod[]> = {};
  for (const m of activeMethods) {
    if (!byZone[m.zone]) byZone[m.zone] = [];
    byZone[m.zone].push(m);
  }
  const zoneKeys = Object.keys(byZone).sort((a, b) => (ZONE_ORDER[a] ?? 99) - (ZONE_ORDER[b] ?? 99));
  for (const zone of zoneKeys) {
    byZone[zone].sort((a, b) => (SERVICE_ORDER[a.service] ?? 99) - (SERVICE_ORDER[b.service] ?? 99));
  }

  const neighborNames = neighbors.map((c) => getCountryName(c, locale));
  const neighborLabel = formatList(neighborNames, locale);

  function renderZoneHeader(zone: string) {
    if (zone === "DOMESTIC") {
      return (
        <div className="flex items-center gap-2.5">
          {originCountry && <CountryFlag code={originCountry} size="lg" />}
          <span>{t("zone.DOMESTIC")}</span>
        </div>
      );
    }
    if (zone === "EU_NEAR") {
      return (
        <div className="flex items-center gap-2.5 flex-wrap">
          {neighbors.map((code) => (
            <CountryFlag key={code} code={code} size="lg" />
          ))}
          <span>
            {neighbors.length > 0
              ? t("zone.EU_NEAR_HEADING", { neighbors: neighborLabel })
              : t("zone.EU_NEAR")}
          </span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2.5">
        <CountryFlag code="EU" size="lg" />
        <span>{t("zone.EU_FAR")}</span>
      </div>
    );
  }

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

      {/* Per zone gegroepeerd — zone-header met vlag(gen), dan de methoden
          voor die zone. Alleen MAILBOX is toggleable; STANDARD en SIGNED zijn
          altijd actief in de gekozen scope. */}
      <div className="space-y-4">
        {zoneKeys.map((zone) => (
          <div key={zone} className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">
              {renderZoneHeader(zone)}
            </h4>
            {byZone[zone].map((method) => {
              const Icon = SERVICE_ICONS[method.service as keyof typeof SERVICE_ICONS] ?? Package;
              const isMailbox = method.service === "MAILBOX_PARCEL";
              const isMailboxActive = isMailbox && allowMailbox && !mailboxBlocked && mailboxEligible;
              const isLocked = !isMailbox;

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
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {tListing.rich("shippingDisplay.lockedNote", {
            link: (chunks) => (
              <Link href="/dashboard/verzending" className="font-medium text-primary underline-offset-2 hover:underline">
                {chunks}
              </Link>
            ),
          })}
        </span>
      </div>
    </div>
  );
}

function formatList(names: string[], locale: string): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  const conj = locale === "en" ? "and" : "en";
  if (names.length === 2) return `${names[0]} ${conj} ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} ${conj} ${names[names.length - 1]}`;
}
