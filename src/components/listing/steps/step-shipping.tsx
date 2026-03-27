"use client";

import { useTranslations } from "next-intl";
import { Truck, MapPin, Info, Package } from "lucide-react";
import { DELIVERY_METHODS, PACKAGE_SIZES } from "@/types";
import type { DeliveryMethod, Carrier, PackageSize, ListingType } from "@/types";

interface StepShippingProps {
  listingType: ListingType;
  deliveryMethod: DeliveryMethod;
  freeShipping: boolean;
  shippingCost: number;
  carriers: Carrier[];
  packageSize: PackageSize | "";
  packageCount: number;
  onChange: (field: string, value: unknown) => void;
}

const DELIVERY_ICONS = { PICKUP: MapPin, SHIP: Truck, BOTH: Truck };
const DELIVERY_KEYS: Record<DeliveryMethod, string> = {
  PICKUP: "deliveryPickup",
  SHIP: "deliveryShip",
  BOTH: "deliveryBoth",
};
const PACKAGE_KEYS: Record<PackageSize, string> = {
  LETTER: "packageLetter",
  SMALL: "packageSmall",
  MEDIUM: "packageMedium",
  LARGE: "packageLarge",
};

function PostNLLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="40" rx="6" fill="#FF6600" />
      <text x="50" y="26" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold" fontFamily="Arial, sans-serif">
        PostNL
      </text>
    </svg>
  );
}

function DHLLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="40" rx="6" fill="#FFCC00" />
      <text x="50" y="26" textAnchor="middle" fill="#D40511" fontSize="18" fontWeight="bold" fontFamily="Arial, sans-serif">
        DHL
      </text>
    </svg>
  );
}

export function StepShipping({
  listingType,
  deliveryMethod,
  freeShipping,
  shippingCost,
  carriers,
  packageSize,
  packageCount,
  onChange,
}: StepShippingProps) {
  const t = useTranslations("listing");

  const showShippingDetails = deliveryMethod === "SHIP" || deliveryMethod === "BOTH";
  const showMultiPackage = listingType === "COLLECTION" || listingType === "MULTI_CARD";

  const toggleCarrier = (carrier: Carrier) => {
    const updated = carriers.includes(carrier)
      ? carriers.filter((c) => c !== carrier)
      : [...carriers, carrier];
    onChange("carriers", updated);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">{t("stepShipping")}</h2>

      {/* Delivery method */}
      <div>
        <label className="block text-sm font-medium text-foreground">{t("deliveryMethodLabel")}</label>
        <div className="mt-2 flex flex-wrap gap-3">
          {DELIVERY_METHODS.map((method) => {
            const Icon = DELIVERY_ICONS[method];
            return (
              <button
                key={method}
                type="button"
                onClick={() => onChange("deliveryMethod", method)}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-all ${
                  deliveryMethod === method
                    ? "border-primary bg-primary text-white shadow-md"
                    : "glass-subtle text-foreground hover:bg-white/60 dark:hover:bg-white/10"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t(DELIVERY_KEYS[method])}
              </button>
            );
          })}
        </div>
      </div>

      {showShippingDetails && (
        <>
          {/* Free shipping toggle */}
          <div className="flex items-center justify-between glass-subtle rounded-xl p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{t("freeShipping")}</span>
              <div className="group relative">
                <Info className="h-4 w-4 text-muted-foreground" />
                <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 rounded-lg bg-foreground px-3 py-1.5 text-xs text-background shadow-lg group-hover:block whitespace-nowrap">
                  {t("freeShippingTooltip")}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onChange("freeShipping", !freeShipping)}
              className={`relative h-6 w-11 rounded-full transition-colors ${freeShipping ? "bg-primary" : "bg-muted"}`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${freeShipping ? "translate-x-5" : ""}`}
              />
            </button>
          </div>

          {/* Shipping cost (hidden if free) */}
          {!freeShipping && (
            <div>
              <label htmlFor="shippingCost" className="block text-sm font-medium text-foreground">{t("shippingCost")}</label>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-muted-foreground">&euro;</span>
                <input
                  id="shippingCost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={shippingCost || ""}
                  onChange={(e) => onChange("shippingCost", parseFloat(e.target.value) || 0)}
                  className="block w-48 glass-input px-3 py-2.5 text-foreground"
                />
              </div>
            </div>
          )}

          {/* Carrier selection with logos */}
          <div>
            <label className="block text-sm font-medium text-foreground">{t("carrierLabel")}</label>
            <div className="mt-2 flex flex-wrap gap-3">
              {/* PostNL */}
              <button
                type="button"
                onClick={() => toggleCarrier("POSTNL")}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                  carriers.includes("POSTNL")
                    ? "border-primary bg-primary/10"
                    : "glass-subtle hover:bg-white/60 dark:hover:bg-white/10"
                }`}
              >
                <input type="checkbox" checked={carriers.includes("POSTNL")} readOnly className="h-4 w-4 accent-primary" />
                <PostNLLogo className="h-7 w-auto" />
              </button>

              {/* DHL */}
              <button
                type="button"
                onClick={() => toggleCarrier("DHL")}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                  carriers.includes("DHL")
                    ? "border-primary bg-primary/10"
                    : "glass-subtle hover:bg-white/60 dark:hover:bg-white/10"
                }`}
              >
                <input type="checkbox" checked={carriers.includes("DHL")} readOnly className="h-4 w-4 accent-primary" />
                <DHLLogo className="h-7 w-auto" />
              </button>

              {/* Self */}
              <button
                type="button"
                onClick={() => toggleCarrier("SELF")}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-all ${
                  carriers.includes("SELF")
                    ? "border-primary bg-primary/10 text-primary"
                    : "glass-subtle text-foreground hover:bg-white/60 dark:hover:bg-white/10"
                }`}
              >
                <input type="checkbox" checked={carriers.includes("SELF")} readOnly className="h-4 w-4 accent-primary" />
                <Package className="h-5 w-5" />
                <span>{t("carrierSelf")}</span>
              </button>
            </div>
          </div>

          {/* Package size */}
          <div>
            <label className="block text-sm font-medium text-foreground">{t("packageSizeLabel")}</label>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PACKAGE_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => onChange("packageSize", size)}
                  className={`rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                    packageSize === size
                      ? "border-primary bg-primary/10 text-primary"
                      : "glass-subtle text-foreground hover:bg-white/60 dark:hover:bg-white/10"
                  }`}
                >
                  {t(PACKAGE_KEYS[size])}
                </button>
              ))}
            </div>
          </div>

          {/* Multiple packages */}
          {showMultiPackage && (
            <div>
              <label htmlFor="packageCount" className="block text-sm font-medium text-foreground">{t("packageCountLabel")}</label>
              <p className="mt-0.5 text-xs text-muted-foreground">{t("packageCountHint")}</p>
              <input
                id="packageCount"
                type="number"
                min={1}
                max={10}
                value={packageCount}
                onChange={(e) => onChange("packageCount", parseInt(e.target.value) || 1)}
                className="mt-1 block w-24 glass-input px-3 py-2.5 text-foreground"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
