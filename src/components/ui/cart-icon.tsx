"use client";

import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { getCartCount } from "@/actions/cart";
import { useRealtime } from "@/components/providers/realtime-provider";

export function CartIcon() {
  const locale = useLocale();
  const [count, setCount] = useState(0);
  const { subscribe } = useRealtime();

  useEffect(() => {
    getCartCount().then(setCount);
    // 30s polling als fallback voor disconnected SSE
    const interval = setInterval(() => {
      getCartCount().then(setCount);
    }, 30000);

    const handleCartUpdated = () => {
      getCartCount().then(setCount);
    };
    window.addEventListener("cart-updated", handleCartUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener("cart-updated", handleCartUpdated);
    };
  }, []);

  // Real-time: andere claimers die expirenwn / cart-content cleared bij checkout
  // / 15-min cron — alle paden publishen cart-changed met verse count.
  useEffect(() => {
    return subscribe("cart-changed", (event) => {
      if (event.type !== "cart-changed") return;
      setCount(event.payload.count);
    });
  }, [subscribe]);

  return (
    <Link
      href={`/${locale}/winkelwagen`}
      className="relative rounded-md p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
      title="Winkelwagen"
    >
      <ShoppingCart className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
