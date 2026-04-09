"use client";

import { useTranslations } from "next-intl";
import { useState, useMemo } from "react";
import { Info } from "lucide-react";
import type { CartSellerGroup } from "@/actions/cart";
import { CartItemRow } from "@/components/cart/cart-item-row";
import { CartCheckout } from "@/components/cart/cart-checkout";
import { ShippingMethodPicker } from "@/components/checkout/shipping-method-picker";

interface CartContentProps {
  groups: CartSellerGroup[];
  buyerCountry: string | null;
  hasAddress: boolean;
  availableBalance: number;
}

export function CartContent({ groups, buyerCountry, hasAddress, availableBalance }: CartContentProps) {
  const t = useTranslations("cart");
  const [shippingSelections, setShippingSelections] = useState<Record<string, string>>({});

  const selectMethod = (sellerId: string, methodId: string) => {
    setShippingSelections((prev) => ({ ...prev, [sellerId]: methodId }));
  };

  // Calculate totals — exclude DELETED and expired items
  const { grandTotal, groupTotals, requiresMethodSelection } = useMemo(() => {
    let total = 0;
    let needsSelection = false;
    const totals = new Map<string, { itemTotal: number; shippingCost: number; groupTotal: number }>();

    for (const group of groups) {
      // Only count CLAIMED items (active claims, not deleted/sold/expired)
      const activeItems = group.items.filter((i) => {
        if (i.status !== "CLAIMED") return false;
        if (i.expiresAt && new Date(i.expiresAt).getTime() < Date.now()) return false;
        return true;
      });
      const itemTotal = activeItems.reduce((sum, i) => sum + i.price, 0);

      let shippingCost = 0;
      if (activeItems.length > 0) {
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
      totals.set(group.sellerId, { itemTotal, shippingCost, groupTotal });
      total += groupTotal;
    }

    return { grandTotal: total, groupTotals: totals, requiresMethodSelection: needsSelection };
  }, [groups, shippingSelections]);

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

            {/* Shipping method picker */}
            {group.shippingMethods.length > 0 && buyerCountry && (
              <div className="border-t border-border px-5 py-3">
                <ShippingMethodPicker
                  methods={group.shippingMethods}
                  buyerCountry={buyerCountry}
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
                  &euro;{totals.shippingCost.toFixed(2)}
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
          hasAddress={hasAddress}
          requiresMethodSelection={requiresMethodSelection}
          availableBalance={availableBalance}
        />
      </div>
    </div>
  );
}