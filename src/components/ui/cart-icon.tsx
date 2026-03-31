"use client";

import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { getCartCount } from "@/actions/cart";

export function CartIcon() {
  const locale = useLocale();
  const [count, setCount] = useState(0);

  useEffect(() => {
    getCartCount().then(setCount);
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

  return (
    <Link
      href={`/${locale}/winkelwagen`}
      className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10 dark:hover:text-white"
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
