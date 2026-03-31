"use client";

import { useTranslations } from "next-intl";
import { useState, useMemo } from "react";
import type { CartSellerGroup } from "@/actions/cart";
import { CartItemRow } from "@/components/cart/cart-item-row";
import { CartCheckout } from "@/components/cart/cart-checkout";
import { ShippingMethodPicker } from "@/components/checkout/shipping-method-picker";

interface CartContentProps {
  groups: CartSellerGroup[];
  buyerCountry: string | null;
  hasAddress: boolean;
}

export function CartContent({ groups, buyerCountry, hasAddress }: CartContentProps) {
  const t = useTranslations("cart");
  const [shippingSelections, setShippingSelections] = useState<Record<string, string>>({});

  const selectMethod = (sellerId: string, methodId: string) => {
    setShippingSelections((prev) => ({ ...prev, [sellerId]: methodId }));
  };

  // Calculate totals based on selected shipping methods
  const { grandTotal, groupTotals, requiresMethodSelection } = useMemo(() => {
    let total = 0;
    let needsSelection = false;
    const totals = new Map<string, { itemTotal: number; shippingCost: number; groupTotal: number }>();

    for (const group of groups) {
      const availableItems = group.items.filter((i) => i.status === "AVAILABLE");
      const itemTotal = availableItems.reduce((sum, i) => sum + i.price, 0);

      let shippingCost = 0;
      if (availableItems.length > 0) {
        if (group.shippingMethods.length > 0) {
          // New method system
          const selectedId = shippingSelections[group.sellerId];
          const selectedMethod = group.shippingMethods.find((m) => m.id === selectedId);
          if (selectedMethod) {
            shippingCost = selectedMethod.price;
          } else {
            needsSelection = true;
          }
        } else {
          // Legacy fallback
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
      {groups.map((group) => {
        const totals = groupTotals.get(group.sellerId)!;

        return (
          <div
            key={group.sellerId}
            className="overflow-hidden rounded-2xl border border-border bg-white/60 backdrop-blur-sm"
          >
            {/* Seller header */}
            <div className="border-b border-border bg-muted/50/80 px-5 py-3">
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
                />
              ))}
            </div>

            {/* Shipping method picker (if methods available) */}
            {group.shippingMethods.length > 0 && buyerCountry && (
              <div className="border-t border-border px-5 py-3">
                <ShippingMethodPicker
                  methods={group.shippingMethods}
                  buyerCountry={buyerCountry}
                  selected={shippingSelections[group.sellerId] || null}
                  onChange={(methodId) => selectMethod(group.sellerId, methodId)}
                />
              </div>
            )}

            {/* Group totals */}
            <div className="border-t border-border bg-muted/50/80 px-5 py-3">
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
      <div className="rounded-2xl border border-border bg-white/60 p-5 backdrop-blur-sm">
        <div className="mb-4 flex items-center justify-between">
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
        />
      </div>
    </div>
  );
}
