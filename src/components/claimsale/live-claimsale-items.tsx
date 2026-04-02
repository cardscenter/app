"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ClaimsaleItemsFilter, type ClaimsaleItem } from "./claimsale-items-filter";

interface StatusItem {
  id: string;
  status: string;
  price: number;
  cardName: string;
  condition: string;
  imageUrls: string;
}

interface StatusResponse {
  items: StatusItem[];
  totalAvailable: number;
  totalClaimed: number;
  totalSold: number;
}

interface LiveClaimsaleItemsProps {
  claimsaleId: string;
  initialItems: ClaimsaleItem[];
  isOwner: boolean;
  isLive: boolean;
  hasSession: boolean;
}

export function LiveClaimsaleItems({
  claimsaleId,
  initialItems,
  isOwner,
  isLive,
  hasSession,
}: LiveClaimsaleItemsProps) {
  const t = useTranslations("claimsale");
  const [items, setItems] = useState<ClaimsaleItem[]>(initialItems);
  const prevStatusRef = useRef<Map<string, string>>(
    new Map(initialItems.map((i) => [i.id, i.status]))
  );

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/claimsales/${claimsaleId}/status`);
      if (!res.ok) return;
      const data: StatusResponse = await res.json();

      const prevStatuses = prevStatusRef.current;
      const newStatuses = new Map<string, string>();

      for (const item of data.items) {
        newStatuses.set(item.id, item.status);
        const prev = prevStatuses.get(item.id);

        if (prev && prev !== item.status) {
          if (item.status === "SOLD" && prev !== "SOLD") {
            toast.info(t("justSold", { name: item.cardName }));
          }
        }
      }

      prevStatusRef.current = newStatuses;

      setItems((current) => {
        const currentMap = new Map(current.map((i) => [i.id, i]));
        const updated: ClaimsaleItem[] = [];

        for (const apiItem of data.items) {
          const existing = currentMap.get(apiItem.id);
          if (existing) {
            updated.push({
              ...existing,
              status: apiItem.status,
              price: apiItem.price,
              cardName: apiItem.cardName,
              condition: apiItem.condition,
              imageUrls: apiItem.imageUrls,
            });
          } else {
            updated.push({
              id: apiItem.id,
              cardName: apiItem.cardName,
              condition: apiItem.condition,
              price: apiItem.price,
              status: apiItem.status,
              imageUrls: apiItem.imageUrls,
              cardSet: null,
              buyer: null,
            });
          }
        }

        return updated;
      });
    } catch {
      // Silent fail — will retry next interval
    }
  }, [claimsaleId, t]);

  useEffect(() => {
    if (!isLive) return;

    const POLL_INTERVAL = 5000;
    let timeoutId: NodeJS.Timeout;

    const poll = () => {
      fetchStatus();
      timeoutId = setTimeout(poll, POLL_INTERVAL);
    };

    timeoutId = setTimeout(poll, POLL_INTERVAL);
    return () => clearTimeout(timeoutId);
  }, [isLive, fetchStatus]);

  return (
    <ClaimsaleItemsFilter
      items={items}
      claimsaleId={claimsaleId}
      isOwner={isOwner}
      isLive={isLive}
      hasSession={hasSession}
    />
  );
}
