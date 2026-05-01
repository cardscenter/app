"use client";

import { useState, useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { X, Package, Truck, MapPin } from "lucide-react";
import {
  createBundleOffer,
  getRecentSellerListingsForBuyer,
} from "@/actions/bundle-offer";
import { MIN_LISTINGS_PER_BUNDLE, MAX_LISTINGS_PER_BUNDLE } from "@/lib/bundle-offer-config";

// Inline copy van `parseImageUrls` — kan niet uit `@/lib/upload` importeren
// omdat dat bestand `fs/promises` gebruikt en server-only is.
function parseImageUrls(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface SellerListing {
  id: string;
  title: string;
  imageUrls: string;
  price: number | null;
  pricingType: string;
  deliveryMethod: string;
  shippingMethods: { shippingMethodId: string; price: number }[];
}

interface SellerShippingMethodLite {
  id: string;
  carrier: string;
  serviceName: string;
  price: number;
}

interface Props {
  conversationId: string;
  sellerId: string;
  sellerShippingMethods: SellerShippingMethodLite[];
  onClose: () => void;
}

export function BundleOfferForm({ conversationId, sellerId, sellerShippingMethods, onClose }: Props) {
  const t = useTranslations("bundleOffer");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [listings, setListings] = useState<SellerListing[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deliveryMethod, setDeliveryMethod] = useState<"SHIP" | "PICKUP">("SHIP");
  const [shippingMethodId, setShippingMethodId] = useState<string>("");
  const [totalAmount, setTotalAmount] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const result = await getRecentSellerListingsForBuyer(sellerId);
      if (result.success) {
        setListings(result.listings as never);
      } else {
        setError(result.error ?? "Geen advertenties gevonden");
      }
      setLoadingListings(false);
    })();
  }, [sellerId]);

  const selected = listings.filter((l) => selectedIds.has(l.id));
  const allSelectedSupportPickup = selected.every(
    (l) => l.deliveryMethod === "PICKUP" || l.deliveryMethod === "BOTH"
  );

  // Wanneer pickup niet meer mogelijk is, val terug op SHIP
  useEffect(() => {
    if (deliveryMethod === "PICKUP" && !allSelectedSupportPickup && selected.length > 0) {
      setDeliveryMethod("SHIP");
    }
  }, [allSelectedSupportPickup, selected.length, deliveryMethod]);

  // Shipping-methods die ALLE geselecteerde listings ondersteunen
  const usableShippingMethodIds = selected.length > 0
    ? sellerShippingMethods.filter((sm) =>
        selected.every((l) => l.shippingMethods.some((ls) => ls.shippingMethodId === sm.id))
      )
    : sellerShippingMethods;

  // Reset shippingMethodId als de geselecteerde niet meer kan
  useEffect(() => {
    if (shippingMethodId && !usableShippingMethodIds.find((sm) => sm.id === shippingMethodId)) {
      setShippingMethodId("");
    }
  }, [shippingMethodId, usableShippingMethodIds]);

  function toggleListing(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_LISTINGS_PER_BUNDLE) next.add(id);
      return next;
    });
  }

  function handleSubmit() {
    setError(null);
    if (selectedIds.size < MIN_LISTINGS_PER_BUNDLE) {
      setError(t("errors.minListings", { min: MIN_LISTINGS_PER_BUNDLE.toString() }));
      return;
    }
    const amount = parseFloat(totalAmount);
    if (!amount || amount <= 0) {
      setError(t("errors.invalidAmount"));
      return;
    }
    if (deliveryMethod === "SHIP" && !shippingMethodId) {
      setError(t("errors.noShippingMethod"));
      return;
    }
    if (deliveryMethod === "PICKUP" && !allSelectedSupportPickup) {
      setError(t("errors.pickupNotSupported"));
      return;
    }

    startTransition(async () => {
      const result = await createBundleOffer({
        conversationId,
        listingIds: Array.from(selectedIds),
        totalAmount: amount,
        deliveryMethod,
        shippingMethodId: deliveryMethod === "SHIP" ? shippingMethodId : undefined,
      });
      if (result.error) setError(result.error);
      else {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="glass max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">{t("createTitle")}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Listings selector */}
        <div className="mb-5">
          <h3 className="mb-2 text-sm font-medium text-foreground">
            {t("selectListings")} ({selectedIds.size}/{MAX_LISTINGS_PER_BUNDLE})
          </h3>
          {loadingListings ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : listings.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noListings")}</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {listings.map((l) => {
                const checked = selectedIds.has(l.id);
                const thumb = parseImageUrls(l.imageUrls)[0];
                return (
                  <button
                    type="button"
                    key={l.id}
                    onClick={() => toggleListing(l.id)}
                    className={`flex items-center gap-2 rounded-lg border p-2 text-left transition-colors ${
                      checked
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <input type="checkbox" checked={checked} readOnly className="h-4 w-4" />
                    {thumb && (
                      <img src={thumb} alt="" className="h-10 w-10 rounded object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{l.title}</p>
                      {l.price !== null && (
                        <p className="text-xs text-muted-foreground">€{l.price.toFixed(2)}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Delivery method */}
        <div className="mb-5">
          <h3 className="mb-2 text-sm font-medium text-foreground">{t("chooseDelivery")}</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDeliveryMethod("SHIP")}
              className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                deliveryMethod === "SHIP" ? "border-primary bg-primary/5 text-primary" : "border-border text-foreground hover:bg-muted"
              }`}
            >
              <Truck className="h-4 w-4" />
              {t("shippingOption")}
            </button>
            <button
              type="button"
              onClick={() => setDeliveryMethod("PICKUP")}
              disabled={selected.length > 0 && !allSelectedSupportPickup}
              className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                deliveryMethod === "PICKUP" ? "border-primary bg-primary/5 text-primary" : "border-border text-foreground hover:bg-muted"
              }`}
            >
              <MapPin className="h-4 w-4" />
              {t("pickupOption")}
            </button>
          </div>
          {selected.length > 0 && !allSelectedSupportPickup && (
            <p className="mt-2 text-xs text-muted-foreground">{t("pickupHint")}</p>
          )}
        </div>

        {/* Shipping method picker (SHIP only) */}
        {deliveryMethod === "SHIP" && (
          <div className="mb-5">
            <label className="mb-2 block text-sm font-medium text-foreground">{t("shippingMethod")}</label>
            <select
              value={shippingMethodId}
              onChange={(e) => setShippingMethodId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">{t("selectShipping")}</option>
              {usableShippingMethodIds.map((sm) => (
                <option key={sm.id} value={sm.id}>
                  {sm.carrier} {sm.serviceName} — €{sm.price.toFixed(2)}
                </option>
              ))}
            </select>
            {usableShippingMethodIds.length === 0 && selected.length > 0 && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{t("errors.noCommonShipping")}</p>
            )}
          </div>
        )}

        {/* Total amount */}
        <div className="mb-5">
          <label className="mb-2 block text-sm font-medium text-foreground">{t("totalAmount")}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-sm text-foreground"
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("amountHint")}</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={pending}
            className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {t("cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={pending || selectedIds.size < MIN_LISTINGS_PER_BUNDLE}
            className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-md transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {pending ? "..." : t("submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
