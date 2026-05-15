"use client";

import { useTranslations } from "next-intl";
import { Trash2, ImageIcon, Clock, X, ShieldCheck } from "lucide-react";
import { removeFromCart } from "@/actions/cart";
import { useState, useEffect } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface CartItemRowProps {
  cartItemId: string;
  cardName: string;
  condition: string;
  price: number;
  cardSetName: string | null;
  imageUrls: string[];
  status: string;
  // Claim timer
  expiresAt: string | null;
  // Change detection
  snapshotPrice: number | null;
  priceChanged: boolean;
  nameChanged: boolean;
  snapshotCardName: string | null;
}

export function CartItemRow({
  cartItemId,
  cardName,
  condition,
  price,
  cardSetName,
  imageUrls,
  status,
  expiresAt,
  snapshotPrice,
  priceChanged,
  nameChanged,
  snapshotCardName,
}: CartItemRowProps) {
  const t = useTranslations("cart");
  const [removing, setRemoving] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [checkoutLocked, setCheckoutLocked] = useState(false);
  const router = useRouter();

  // Listen naar checkout-lock events vanuit CartCheckout. Bij open:
  // pauzeer de timer-display + voorkom auto-refresh op expired. Bij cancel:
  // hervat normaal. (Feitelijke server-side lock zit op claimsaleItem
  // checkoutLockExpiresAt, dit is puur UI-pauze tegen hartkloppingen.)
  useEffect(() => {
    function lock() {
      setCheckoutLocked(true);
    }
    function unlock() {
      setCheckoutLocked(false);
    }
    window.addEventListener("cart-checkout-locked", lock);
    window.addEventListener("cart-checkout-unlocked", unlock);
    return () => {
      window.removeEventListener("cart-checkout-locked", lock);
      window.removeEventListener("cart-checkout-unlocked", unlock);
    };
  }, []);

  // Countdown timer — gepauzeerd tijdens checkout-lock zodat de buyer niet
  // schrikt van een seconde-naar-nul-aftellende klok terwijl de modal open is.
  useEffect(() => {
    if (!expiresAt || checkoutLocked) return;

    const update = () => {
      const remaining = new Date(expiresAt).getTime() - Date.now();
      if (remaining <= 0) {
        setExpired(true);
        setTimeLeft("0:00");
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setTimeLeft(`${mins}:${secs.toString().padStart(2, "0")}`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, checkoutLocked]);

  // Auto refresh when expired — overslaan tijdens checkout-lock zodat
  // de page niet onder de modal verdwijnt.
  useEffect(() => {
    if (expired && !checkoutLocked) {
      const timeout = setTimeout(() => router.refresh(), 2000);
      return () => clearTimeout(timeout);
    }
  }, [expired, checkoutLocked, router]);

  async function handleRemove() {
    setRemoving(true);
    const result = await removeFromCart(cartItemId);
    if (result?.error) {
      toast.error(result.error);
      setRemoving(false);
    } else {
      toast.success(t("itemRemoved"));
      window.dispatchEvent(new CustomEvent("cart-updated"));
      router.refresh();
    }
  }

  const isDeleted = status === "DELETED";
  const isUnavailable = isDeleted || expired || (status !== "CLAIMED" && status !== "AVAILABLE");

  // Timer color: green > 5min, orange 1-5min, red < 1min
  const timerColor = (() => {
    if (!expiresAt) return "";
    const remaining = new Date(expiresAt).getTime() - Date.now();
    if (remaining <= 60000) return "text-red-500";
    if (remaining <= 300000) return "text-amber-500";
    return "text-green-600 dark:text-green-400";
  })();

  return (
    <>
      {/* Zoomed image overlay */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setZoomedImage(null)}
        >
          <button
            onClick={() => setZoomedImage(null)}
            className="absolute top-4 right-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 transition-colors"
          >
            <X className="size-6" />
          </button>
          <div className="relative max-h-[85vh] max-w-[85vw]">
            <Image
              src={zoomedImage}
              alt={cardName}
              width={384}
              height={540}
              className="rounded-lg object-contain max-h-[85vh]"
            />
          </div>
        </div>
      )}

    <div className={`flex items-center gap-4 py-3 ${isUnavailable ? "opacity-50" : ""}`}>
      {/* Thumbnail (32:45 portrait, clickable) */}
      {imageUrls.length > 0 ? (
        <button
          type="button"
          onClick={() => setZoomedImage(imageUrls[0])}
          className="shrink-0 overflow-hidden rounded-lg border border-border"
          style={{ width: 42, height: 59 }}
        >
          <Image
            src={imageUrls[0]}
            alt={cardName}
            width={42}
            height={59}
            className="h-full w-full object-cover"
          />
        </button>
      ) : (
        <div className="flex shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50" style={{ width: 42, height: 59 }}>
          <ImageIcon className="h-5 w-5 text-muted-foreground" />
        </div>
      )}

      {/* Details */}
      <div className="min-w-0 flex-1">
        <p className={`truncate font-medium text-foreground ${isDeleted ? "line-through" : ""}`}>
          {cardName}
        </p>
        <p className="text-xs text-muted-foreground">
          {cardSetName ? `${cardSetName} · ` : ""}{condition}
        </p>
        {isDeleted && (
          <p className="text-xs font-medium text-red-500">{t("itemUnavailable")}</p>
        )}
        {expired && !isDeleted && (
          <p className="text-xs font-medium text-amber-600">{t("claimExpired")}</p>
        )}
        {!isUnavailable && priceChanged && snapshotPrice != null && (
          <p className="text-xs font-medium text-amber-600">
            {t("priceChanged", { old: snapshotPrice.toFixed(2), new: price.toFixed(2) })}
          </p>
        )}
        {!isUnavailable && nameChanged && snapshotCardName && (
          <p className="text-xs text-muted-foreground">
            {t("nameChanged", { name: cardName })}
          </p>
        )}
      </div>

      {/* Timer — toont "Vastgezet" tijdens checkout-modal ipv aftellende klok
          zodat de buyer niet zenuwachtig wordt door 0:00 in de achtergrond. */}
      {checkoutLocked && !isDeleted ? (
        <div className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          Vastgezet
        </div>
      ) : (
        timeLeft && !isDeleted && (
          <div className={`flex shrink-0 items-center gap-1 text-xs font-medium ${timerColor}`}>
            <Clock className="h-3.5 w-3.5" />
            {timeLeft}
          </div>
        )
      )}

      {/* Price */}
      <p className={`shrink-0 font-medium text-foreground ${isDeleted ? "line-through" : ""}`}>
        &euro;{price.toFixed(2)}
      </p>

      {/* Remove */}
      <button
        onClick={handleRemove}
        disabled={removing}
        className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 disabled:opacity-50"
        title={t("remove")}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
    </>
  );
}
