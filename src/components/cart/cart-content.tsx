"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Info, Package } from "lucide-react";
import type { CartSellerGroup } from "@/actions/cart";
import { CartItemRow } from "@/components/cart/cart-item-row";
import { CartCheckout } from "@/components/cart/cart-checkout";
import { ShippingMethodPicker } from "@/components/checkout/shipping-method-picker";
import { useRealtime } from "@/components/providers/realtime-provider";
import type { CombinableBundle } from "@/lib/shipping-bundle";

interface CartContentProps {
  groups: CartSellerGroup[];
  buyerCountry: string | null;
  hasAddress: boolean;
  availableBalance: number;
  combinableBundles: Record<string, CombinableBundle>;
}

export function CartContent({ groups, buyerCountry, hasAddress, availableBalance, combinableBundles }: CartContentProps) {
  const t = useTranslations("cart");
  const router = useRouter();
  const [shippingSelections, setShippingSelections] = useState<Record<string, string>>({});
  // Per-seller keuze: true = voeg toe aan bestaande bundle, false = nieuwe
  // aparte bestelling. Default true (merge bespaart verzendkosten).
  const [mergeChoices, setMergeChoices] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const sellerId of Object.keys(combinableBundles)) init[sellerId] = true;
    return init;
  });
  const { subscribe } = useRealtime();

  // Real-time: bij cart-changed event (15-min expiry, andere checkout)
  // herladen we de page zodat verlopen items echt verdwijnen.
  useEffect(() => {
    return subscribe("cart-changed", () => {
      router.refresh();
    });
  }, [subscribe, router]);

  const selectMethod = (sellerId: string, methodId: string) => {
    setShippingSelections((prev) => ({ ...prev, [sellerId]: methodId }));
  };

  const setMerge = (sellerId: string, merge: boolean) => {
    setMergeChoices((prev) => ({ ...prev, [sellerId]: merge }));
  };

  // Calculate totals — exclude DELETED and expired items
  const { grandTotal, groupTotals, requiresMethodSelection } = useMemo(() => {
    let total = 0;
    let needsSelection = false;
    const totals = new Map<string, { itemTotal: number; shippingCost: number; groupTotal: number; merged: boolean }>();

    for (const group of groups) {
      // Only count CLAIMED items (active claims, not deleted/sold/expired)
      const activeItems = group.items.filter((i) => {
        if (i.status !== "CLAIMED") return false;
        if (i.expiresAt && new Date(i.expiresAt).getTime() < Date.now()) return false;
        return true;
      });
      const itemTotal = activeItems.reduce((sum, i) => sum + i.price, 0);

      const merged = !!(combinableBundles[group.sellerId] && mergeChoices[group.sellerId]);

      let shippingCost = 0;
      if (activeItems.length > 0 && !merged) {
        if (group.shippingMethods.length > 0) {
          const selectedId = shippingSelections[group.sellerId];
          const selectedMethod = group.shippingMethods.find((m) => m.id === selectedId);
          if (selectedMethod) {
            shippingCost = selectedMethod.price;
          } else {
            needsSelection = true;
          }
        } else {
          shippingCost = group.shippingCost;
        }
      }

      const groupTotal = itemTotal + shippingCost;
      totals.set(group.sellerId, { itemTotal, shippingCost, groupTotal, merged });
      total += groupTotal;
    }

    return { grandTotal: total, groupTotals: totals, requiresMethodSelection: needsSelection };
  }, [groups, shippingSelections, mergeChoices, combinableBundles]);

  return (
    <div className="mt-6 space-y-6">
      {/* Claim timer info banner */}
      <div className="flex items-start gap-2 rounded-xl bg-blue-50/80 p-3 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>{t("claimWarning")}</p>
      </div>

      {groups.map((group) => {
        const totals = groupTotals.get(group.sellerId)!;

        return (
          <div
            key={group.sellerId}
            className="overflow-hidden rounded-2xl border border-border bg-card"
          >
            {/* Seller header */}
            <div className="border-b border-border bg-muted/50 px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">
                {t("sellerGroup", { name: group.sellerName })}
              </h2>
            </div>

            {/* Items */}
            <div className="divide-y divide-border px-5">
              {group.items.map((item) => (
                <CartItemRow
                  key={item.cartItemId}
                  cartItemId={item.cartItemId}
                  cardName={item.cardName}
                  condition={item.condition}
                  price={item.price}
                  cardSetName={item.cardSetName}
                  imageUrls={item.imageUrls}
                  status={item.status}
                  expiresAt={item.expiresAt}
                  snapshotPrice={item.snapshotPrice}
                  snapshotCardName={item.snapshotCardName}
                  priceChanged={item.priceChanged}
                  nameChanged={item.nameChanged}
                />
              ))}
            </div>

            {/* Merge-keuze: voeg toe aan vorige bestelling vs nieuwe aparte bestelling.
                Alleen tonen als er een combinable bundle is bij deze verkoper. */}
            {combinableBundles[group.sellerId] && (
              <div className="border-t border-border bg-muted/30 px-5 py-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <Package className="h-3.5 w-3.5 text-primary" />
                  {t("combineWithPrevious")}
                </p>
                <div className="space-y-1.5">
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <input
                      type="radio"
                      name={`merge-${group.sellerId}`}
                      checked={mergeChoices[group.sellerId] === true}
                      onChange={() => setMerge(group.sellerId, true)}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-foreground">
                        {t("mergeAddToExisting", { orderNumber: combinableBundles[group.sellerId].orderNumber })}
                      </div>
                      <div className="text-xs text-muted-foreground">{t("mergeSavesShipping")}</div>
                    </div>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <input
                      type="radio"
                      name={`merge-${group.sellerId}`}
                      checked={mergeChoices[group.sellerId] === false}
                      onChange={() => setMerge(group.sellerId, false)}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{t("mergeNewSeparateOrder")}</div>
                      <div className="text-xs text-muted-foreground">{t("mergeNewSeparateDesc")}</div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Shipping method picker — verborgen wanneer er gemerged wordt */}
            {!totals.merged && group.shippingMethods.length > 0 && buyerCountry && (
              <div className="border-t border-border px-5 py-3">
                <ShippingMethodPicker
                  methods={group.shippingMethods}
                  buyerCountry={buyerCountry}
                  itemTotal={totals.itemTotal}
                  itemCount={group.items.length}
                  selected={shippingSelections[group.sellerId] || null}
                  onChange={(methodId) => selectMethod(group.sellerId, methodId)}
                />
              </div>
            )}

            {/* Group totals */}
            <div className="border-t border-border bg-muted/50 px-5 py-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("subtotal")}</span>
                <span className="font-medium text-foreground">
                  &euro;{totals.itemTotal.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("shipping")}</span>
                <span className="font-medium text-foreground">
                  {totals.merged ? t("mergeNoExtraShipping") : `€${totals.shippingCost.toFixed(2)}`}
                </span>
              </div>
              <div className="mt-1 flex justify-between border-t border-border pt-1 text-sm">
                <span className="font-semibold text-foreground">{t("total")}</span>
                <span className="font-semibold text-foreground">
                  &euro;{totals.groupTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {/* Grand total + checkout */}
      <div className="rounded-2xl border border-border bg-card p-5">
        {/* Breakdown per seller */}
        <div className="mb-3 space-y-1.5">
          {groups.map((group) => {
            const totals = groupTotals.get(group.sellerId)!;
            const activeCount = group.items.filter((i) =>
              i.status === "CLAIMED" && (!i.expiresAt || new Date(i.expiresAt).getTime() > Date.now())
            ).length;
            if (activeCount === 0) return null;
            return (
              <div key={group.sellerId} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {group.sellerName}
                  <span className="ml-1.5 text-xs">({activeCount} {activeCount === 1 ? "kaart" : "kaarten"})</span>
                </span>
                <span className="font-medium text-foreground">&euro;{totals.itemTotal.toFixed(2)}</span>
              </div>
            );
          })}
          {/* Total shipping */}
          {(() => {
            const totalShipping = Array.from(groupTotals.values()).reduce((sum, g) => sum + g.shippingCost, 0);
            const shipmentCount = Array.from(groupTotals.values()).filter((g) => g.shippingCost > 0).length;
            return (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("shipping")}
                  {shipmentCount > 0 && (
                    <span className="ml-1.5 text-xs">({shipmentCount} {shipmentCount === 1 ? "zending" : "zendingen"})</span>
                  )}
                </span>
                <span className="font-medium text-foreground">&euro;{totalShipping.toFixed(2)}</span>
              </div>
            );
          })()}
        </div>

        {/* Grand total */}
        <div className="mb-4 flex items-center justify-between border-t border-border pt-3">
          <span className="text-lg font-bold text-foreground">
            {t("total")}
          </span>
          <span className="text-lg font-bold text-foreground">
            &euro;{grandTotal.toFixed(2)}
          </span>
        </div>
        <CartCheckout
          totalCost={grandTotal}
          shippingSelections={shippingSelections}
          mergeIntoBundles={Object.fromEntries(
            Object.entries(combinableBundles)
              .filter(([sellerId]) => mergeChoices[sellerId])
              .map(([sellerId, bundle]) => [sellerId, bundle.id])
          )}
          hasAddress={hasAddress}
          requiresMethodSelection={requiresMethodSelection}
          availableBalance={availableBalance}
        />
      </div>
    </div>
  );
}