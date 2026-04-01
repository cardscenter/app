"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function AuctionCreatedToast() {
  const searchParams = useSearchParams();
  const t = useTranslations("auction");
  const shown = useRef(false);

  useEffect(() => {
    if (searchParams.get("created") === "1" && !shown.current) {
      shown.current = true;
      toast.success(t("auctionCreated"));
      // Remove query param without triggering navigation
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [searchParams, t]);

  return null;
}
