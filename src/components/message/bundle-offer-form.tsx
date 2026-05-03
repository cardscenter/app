"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { X, Package, Truck, MapPin, ShieldCheck, Info, Search } from "lucide-react";
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
  allowPlatformPickup: boolean;
  allowExternalPickup: boolean;
  listingType: string;
  condition: string | null;
  cardName: string | null;
  description: string;
}

type DeliveryChoice = "SHIP" | "PICKUP_PLATFORM" | "PICKUP_EXTERNAL";

interface Props {
  conversationId: string;
  sellerId: string;
  onClose: () => void;
}

const SEARCH_THRESHOLD = 8;

export function BundleOfferForm({ conversationId, sellerId, onClose }: Props) {
  const t = useTranslations("bundleOffer");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [listings, setListings] = useState<SellerListing[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deliveryChoice, setDeliveryChoice] = useState<DeliveryChoice>("SHIP");
  const [requestInsured, setRequestInsured] = useState(false);
  const [totalAmount, setTotalAmount] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [detailListing, setDetailListing] = useState<SellerListing | null>(null);

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

  const filteredListings = useMemo(() => {
    if (!searchQuery.trim()) return listings;
    const q = searchQuery.toLowerCase();
    return listings.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.cardName?.toLowerCase().includes(q) ||
        l.condition?.toLowerCase().includes(q)
    );
  }, [listings, searchQuery]);

  const selected = listings.filter((l) => selectedIds.has(l.id));
  const allSelectedSupportPickup = selected.every(
    (l) => l.deliveryMethod === "PICKUP" || l.deliveryMethod === "BOTH"
  );
  const allSelectedSupportShip = selected.every(
    (l) => l.deliveryMethod === "SHIP" || l.deliveryMethod === "BOTH"
  );
  const allSelectedAllowPlatformPickup = selected.every((l) => l.allowPlatformPickup);
  const allSelectedAllowExternalPickup = selected.every((l) => l.allowExternalPickup);

  const canShip = selected.length === 0 || allSelectedSupportShip;
  const canPickupPlatform = selected.length > 0 && allSelectedSupportPickup && allSelectedAllowPlatformPickup;
  const canPickupExternal = selected.length > 0 && allSelectedSupportPickup && allSelectedAllowExternalPickup;

  // Auto-fallback bij niet-mogelijke keuze
  useEffect(() => {
    if (selected.length === 0) return;
    if (deliveryChoice === "SHIP" && !canShip) {
      setDeliveryChoice(canPickupPlatform ? "PICKUP_PLATFORM" : canPickupExternal ? "PICKUP_EXTERNAL" : "SHIP");
    } else if (deliveryChoice === "PICKUP_PLATFORM" && !canPickupPlatform) {
      setDeliveryChoice(canShip ? "SHIP" : canPickupExternal ? "PICKUP_EXTERNAL" : "SHIP");
    } else if (deliveryChoice === "PICKUP_EXTERNAL" && !canPickupExternal) {
      setDeliveryChoice(canShip ? "SHIP" : canPickupPlatform ? "PICKUP_PLATFORM" : "SHIP");
    }
  }, [canShip, canPickupPlatform, canPickupExternal, selected.length, deliveryChoice]);

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
    if (deliveryChoice !== "SHIP" && !allSelectedSupportPickup) {
      setError(t("errors.pickupNotSupported"));
      return;
    }

    startTransition(async () => {
      const result = await createBundleOffer({
        conversationId,
        listingIds: Array.from(selectedIds),
        totalAmount: amount,
        deliveryChoice,
        requestInsuredShipping: deliveryChoice === "SHIP" ? requestInsured : false,
      });
      if (result.error) setError(result.error);
      else {
        onClose();
        router.refresh();
      }
    });
  }

  // Twee-laagse delivery-button: bovenste regel = bezorging-label,
  // onderste regel = gekleurd betaal-bannertje. Visueel duidelijker dan
  // één lange knop-tekst.
  type DeliveryOption = {
    choice: DeliveryChoice;
    icon: typeof Truck;
    deliveryLabel: string;
    paymentLabel: string;
    paymentBg: string;
    paymentText: string;
    enabled: boolean;
  };
  const options: DeliveryOption[] = [
    {
      choice: "SHIP",
      icon: Truck,
      deliveryLabel: t("deliveryLabels.ship"),
      paymentLabel: t("paymentLabels.now"),
      paymentBg: "bg-emerald-100 dark:bg-emerald-950/40",
      paymentText: "text-emerald-800 dark:text-emerald-200",
      enabled: selected.length === 0 || canShip,
    },
    {
      choice: "PICKUP_PLATFORM",
      icon: MapPin,
      deliveryLabel: t("deliveryLabels.pickup"),
      paymentLabel: t("paymentLabels.now"),
      paymentBg: "bg-blue-100 dark:bg-blue-950/40",
      paymentText: "text-blue-800 dark:text-blue-200",
      enabled: selected.length > 0 && canPickupPlatform,
    },
    {
      choice: "PICKUP_EXTERNAL",
      icon: MapPin,
      deliveryLabel: t("deliveryLabels.pickup"),
      paymentLabel: t("paymentLabels.atPickup"),
      paymentBg: "bg-amber-100 dark:bg-amber-950/40",
      paymentText: "text-amber-800 dark:text-amber-200",
      enabled: selected.length > 0 && canPickupExternal,
    },
  ];

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

        {/* Listings selector — search + scroll voor veel listings */}
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-foreground">
              {t("selectListings")} ({selectedIds.size}/{MAX_LISTINGS_PER_BUNDLE})
            </h3>
            {listings.length >= SEARCH_THRESHOLD && (
              <div className="relative w-44">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("searchListings")}
                  className="w-full rounded-lg border border-border bg-background py-1.5 pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground"
                />
              </div>
            )}
          </div>
          {loadingListings ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : listings.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noListings")}</p>
          ) : (
            <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-border bg-muted/30 p-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {filteredListings.map((l) => {
                  const checked = selectedIds.has(l.id);
                  const thumb = parseImageUrls(l.imageUrls)[0];
                  return (
                    <div
                      key={l.id}
                      className={`flex items-center gap-2 rounded-lg border bg-card p-2 transition-colors ${
                        checked ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleListing(l.id)}
                        className="flex flex-1 items-center gap-2 text-left min-w-0"
                      >
                        <input type="checkbox" checked={checked} readOnly className="h-4 w-4 flex-shrink-0" />
                        {thumb && (
                          <img src={thumb} alt="" className="h-10 w-10 flex-shrink-0 rounded object-cover" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{l.title}</p>
                          {l.price !== null && (
                            <p className="text-xs text-muted-foreground">€{l.price.toFixed(2)}</p>
                          )}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailListing(l)}
                        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={t("viewDetails")}
                      >
                        <Info className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
                {filteredListings.length === 0 && (
                  <p className="col-span-full p-4 text-center text-xs text-muted-foreground">
                    {t("noSearchResults")}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Delivery method + payment-banner — Fase 27.65 visueel */}
        <div className="mb-5">
          <h3 className="mb-2 text-sm font-medium text-foreground">{t("chooseDelivery")}</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {options.map((opt) => {
              const Icon = opt.icon;
              const active = deliveryChoice === opt.choice;
              const disabled = !opt.enabled;
              return (
                <button
                  key={opt.choice}
                  type="button"
                  onClick={() => setDeliveryChoice(opt.choice)}
                  disabled={disabled}
                  className={`flex flex-col overflow-hidden rounded-lg border transition-colors disabled:opacity-50 ${
                    active ? "border-primary ring-2 ring-primary/30" : "border-border"
                  }`}
                >
                  <div
                    className={`flex flex-1 items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium ${
                      active ? "bg-primary/5 text-primary" : "bg-card text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {opt.deliveryLabel}
                  </div>
                  <div className={`px-3 py-1 text-center text-[11px] font-medium ${opt.paymentBg} ${opt.paymentText}`}>
                    {opt.paymentLabel}
                  </div>
                </button>
              );
            })}
          </div>
          {selected.length > 0 && !canShip && !canPickupPlatform && !canPickupExternal && (
            <p className="mt-2 text-xs text-red-500">{t("noDeliveryAvailable")}</p>
          )}
          {selected.length > 0 && !allSelectedSupportPickup && (
            <p className="mt-2 text-xs text-muted-foreground">{t("pickupHint")}</p>
          )}
        </div>

        {/* Verzekerd-verzonden toggle (SHIP only). De verkoper kiest later de
            daadwerkelijke verzendmethode bij accept; deze toggle dwingt
            server-side een aangetekende methode af. */}
        {deliveryChoice === "SHIP" && (
          <div className="mb-5">
            <label className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={requestInsured}
                onChange={(e) => setRequestInsured(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  {t("requestInsured.label")}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t("requestInsured.hint")}</p>
              </div>
            </label>
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

      {/* Details mini-popup — Fase 27.65 */}
      {detailListing && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setDetailListing(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-background p-5 shadow-2xl border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-foreground">{detailListing.title}</h3>
              <button
                onClick={() => setDetailListing(null)}
                className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {parseImageUrls(detailListing.imageUrls).length > 0 && (
              <div className="mb-3 flex gap-2 overflow-x-auto">
                {parseImageUrls(detailListing.imageUrls).slice(0, 4).map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className="h-24 w-24 flex-shrink-0 rounded-lg object-cover"
                  />
                ))}
              </div>
            )}
            <div className="space-y-1 text-sm">
              {detailListing.cardName && (
                <p>
                  <span className="text-muted-foreground">{t("details.cardName")}: </span>
                  <span className="text-foreground">{detailListing.cardName}</span>
                </p>
              )}
              {detailListing.condition && (
                <p>
                  <span className="text-muted-foreground">{t("details.condition")}: </span>
                  <span className="text-foreground">{detailListing.condition}</span>
                </p>
              )}
              <p>
                <span className="text-muted-foreground">{t("details.price")}: </span>
                <span className="font-semibold text-foreground">
                  {detailListing.price !== null ? `€${detailListing.price.toFixed(2)}` : t("details.negotiable")}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">{t("details.delivery")}: </span>
                <span className="text-foreground">
                  {detailListing.deliveryMethod === "SHIP"
                    ? t("details.deliveryShip")
                    : detailListing.deliveryMethod === "PICKUP"
                      ? t("details.deliveryPickup")
                      : t("details.deliveryBoth")}
                </span>
              </p>
            </div>
            {detailListing.description && (
              <div className="mt-3 border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">{t("details.description")}</p>
                <div
                  className="prose prose-sm dark:prose-invert max-h-32 overflow-y-auto text-xs text-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                  dangerouslySetInnerHTML={{ __html: detailListing.description }}
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => setDetailListing(null)}
              className="mt-4 w-full rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              {t("details.close")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
