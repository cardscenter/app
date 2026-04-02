"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Search, X, ShoppingCart, Pencil, Trash2 } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AddToCartButton } from "@/components/claimsale/add-to-cart-button";
import { ClaimsaleItemEdit } from "@/components/claimsale/claimsale-item-edit";
import { claimAllItems, deleteClaimsaleItem } from "@/actions/claimsale";

function parseImageUrls(json: string): string[] {
  try { return JSON.parse(json); } catch { return []; }
}

export interface ClaimsaleItem {
  id: string;
  cardName: string;
  condition: string;
  price: number;
  status: string;
  imageUrls: string | null;
  cardSet: {
    name: string;
    series: {
      category: { name: string };
    };
  } | null;
  buyer: { displayName: string } | null;
}

interface ClaimsaleItemsFilterProps {
  items: ClaimsaleItem[];
  claimsaleId: string;
  isOwner: boolean;
  isLive: boolean;
  hasSession: boolean;
}

type SortKey = "name" | "price_asc" | "price_desc" | "condition";

export function ClaimsaleItemsFilter({
  items,
  claimsaleId,
  isOwner,
  isLive,
  hasSession,
}: ClaimsaleItemsFilterProps) {
  const t = useTranslations("claimsale");
  const ts = useTranslations("search");

  const [search, setSearch] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [showClaimAllConfirm, setShowClaimAllConfirm] = useState(false);
  const [claimingAll, setClaimingAll] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const router = useRouter();

  async function handleDeleteItem(itemId: string) {
    setDeletingItemId(itemId);
    const result = await deleteClaimsaleItem(itemId);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(t("itemDeleted"));
      router.refresh();
    }
    setDeletingItemId(null);
  }

  const availableCount = useMemo(
    () => items.filter((i) => i.status === "AVAILABLE").length,
    [items]
  );

  async function handleClaimAll(claimsaleId: string) {
    setClaimingAll(true);
    const result = await claimAllItems(claimsaleId);
    if (result?.error) {
      toast.error(result.error);
    } else if (result.success) {
      toast.success(t("claimAllSuccess", { count: result.claimedCount }));
      window.dispatchEvent(new CustomEvent("cart-updated"));
    }
    setClaimingAll(false);
    setShowClaimAllConfirm(false);
  }

  const conditions = useMemo(() => {
    const set = new Set(items.map((i) => i.condition));
    return Array.from(set).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    // Hide DELETED items from non-owners
    let result = isOwner ? [...items] : items.filter((i) => i.status !== "DELETED");

    // Text search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.cardName.toLowerCase().includes(q) ||
          (i.cardSet?.name.toLowerCase().includes(q) ?? false)
      );
    }

    // Condition filter
    if (conditionFilter) {
      result = result.filter((i) => i.condition === conditionFilter);
    }

    // Sort
    switch (sortBy) {
      case "price_asc":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        result.sort((a, b) => b.price - a.price);
        break;
      case "condition":
        result.sort((a, b) => a.condition.localeCompare(b.condition));
        break;
      case "name":
      default:
        result.sort((a, b) => a.cardName.localeCompare(b.cardName));
        break;
    }

    return result;
  }, [items, search, conditionFilter, sortBy]);

  return (
    <div>
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
              alt=""
              width={600}
              height={800}
              className="rounded-lg object-contain max-h-[85vh]"
            />
          </div>
        </div>
      )}

      {/* Claim all confirmation overlay */}
      {showClaimAllConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowClaimAllConfirm(false)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-xl bg-background p-6 shadow-xl border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-foreground">{t("confirmClaimAll")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("confirmClaimAllDesc", { count: availableCount })}
            </p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setShowClaimAllConfirm(false)}
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                onClick={() => handleClaimAll(claimsaleId)}
                disabled={claimingAll}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50 transition-colors"
              >
                {claimingAll ? "..." : t("claimAll")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Claim all button */}
      {!isOwner && hasSession && isLive && availableCount > 1 && (
        <div className="mb-4">
          <button
            onClick={() => setShowClaimAllConfirm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover transition-colors"
          >
            <ShoppingCart className="h-4 w-4" />
            {t("claimAll")} ({availableCount})
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={ts("placeholder")}
            className="w-full rounded-md border border-border bg-background pl-9 pr-3 py-1.5 text-sm text-foreground"
          />
        </div>
        <select
          value={conditionFilter}
          onChange={(e) => setConditionFilter(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">{ts("allConditions")}</option>
          {conditions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
        >
          <option value="name">{t("cardName")}</option>
          <option value="price_asc">{ts("sortPriceLow")}</option>
          <option value="price_desc">{ts("sortPriceHigh")}</option>
          <option value="condition">{t("condition")}</option>
        </select>
      </div>

      {/* Results count */}
      <p className="mb-2 text-xs text-muted-foreground">
        {filteredItems.length}/{items.length} {t("available").toLowerCase()}
      </p>

      {/* Mobile: card layout */}
      <div className="sm:hidden space-y-3">
        {filteredItems.map((item) => {
          const images = parseImageUrls(item.imageUrls ?? "[]");
          const front = images[0];
          const back = images[1];

          if (editingItemId === item.id) {
            return (
              <ClaimsaleItemEdit
                key={item.id}
                itemId={item.id}
                initialCardName={item.cardName}
                initialCondition={item.condition}
                initialPrice={item.price}
                onClose={() => setEditingItemId(null)}
              />
            );
          }

          return (
            <div key={item.id} className={`flex gap-3 rounded-xl border border-border p-3 ${item.status === "DELETED" ? "opacity-50" : ""}`}>
              {/* Images: front + back */}
              <div className="shrink-0 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => front && setZoomedImage(front)}
                  className="w-20 rounded-lg overflow-hidden bg-muted"
                >
                  {front ? (
                    <Image
                      src={front}
                      alt={item.cardName}
                      width={80}
                      height={112}
                      className="object-cover w-20 h-28"
                    />
                  ) : (
                    <div className="w-20 h-28 bg-muted" />
                  )}
                </button>
                {back && (
                  <button
                    type="button"
                    onClick={() => setZoomedImage(back)}
                    className="w-20 rounded-lg overflow-hidden bg-muted"
                  >
                    <Image
                      src={back}
                      alt={`${item.cardName} achterkant`}
                      width={80}
                      height={112}
                      className="object-cover w-20 h-28"
                    />
                  </button>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 flex flex-col justify-between min-w-0">
                <div>
                  <h4 className="font-semibold text-sm text-foreground line-clamp-2">
                    {item.cardName}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.condition}
                  </p>
                </div>
                <div className="flex items-end justify-between mt-2">
                  <span className="text-lg font-bold text-foreground">
                    &euro;{item.price.toFixed(2)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {/* Owner edit/delete controls */}
                    {isOwner && isLive && item.status !== "SOLD" && item.status !== "DELETED" && (
                      <>
                        <button
                          onClick={() => setEditingItemId(item.id)}
                          className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={deletingItemId === item.id}
                          className="rounded-md p-1 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    {/* Status badges */}
                    {item.status === "AVAILABLE" && isLive && !isOwner && hasSession ? (
                      <AddToCartButton itemId={item.id} cardName={item.cardName} />
                    ) : item.status === "CLAIMED" ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                        {t("claimed")}
                      </span>
                    ) : item.status === "SOLD" ? (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        {t("sold")}
                      </span>
                    ) : item.status === "DELETED" && isOwner ? (
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-400">
                        {t("deleted")}
                      </span>
                    ) : item.status !== "DELETED" ? (
                      <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                        {t("available")}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filteredItems.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {ts("noResultsHint")}
          </p>
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground w-28">
                Foto
              </th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">
                {t("cardName")}
              </th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">
                {t("condition")}
              </th>
              <th className="px-3 py-3 text-right font-medium text-muted-foreground">
                {t("price")}
              </th>
              <th className="px-3 py-3 text-center font-medium text-muted-foreground">
                Status
              </th>
              {isOwner && isLive && (
                <th className="px-3 py-3 text-center font-medium text-muted-foreground w-20" />
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredItems.map((item) => {
              const images = parseImageUrls(item.imageUrls ?? "[]");
              const front = images[0];
              const back = images[1];

              if (editingItemId === item.id) {
                return (
                  <tr key={item.id}>
                    <td colSpan={isOwner && isLive ? 6 : 5} className="px-3 py-2">
                      <ClaimsaleItemEdit
                        itemId={item.id}
                        initialCardName={item.cardName}
                        initialCondition={item.condition}
                        initialPrice={item.price}
                        onClose={() => setEditingItemId(null)}
                      />
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={item.id} className={item.status === "DELETED" ? "opacity-50" : ""}>
                  <td className="px-3 py-2">
                    <div className="flex gap-1.5">
                      {front ? (
                        <div className="group/thumb relative">
                          <button
                            type="button"
                            onClick={() => setZoomedImage(front)}
                            className="block rounded overflow-hidden bg-muted cursor-pointer"
                          >
                            <Image
                              src={front}
                              alt={item.cardName}
                              width={40}
                              height={56}
                              className="object-cover w-10 h-14"
                            />
                          </button>
                          {/* Hover zoom */}
                          <div className="hidden group-hover/thumb:block absolute left-12 top-1/2 -translate-y-1/2 z-40 rounded-lg shadow-xl overflow-hidden border border-border bg-background">
                            <Image
                              src={front}
                              alt={item.cardName}
                              width={200}
                              height={280}
                              className="object-contain"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="w-10 h-14 rounded bg-muted" />
                      )}
                      {back && (
                        <div className="group/back relative">
                          <button
                            type="button"
                            onClick={() => setZoomedImage(back)}
                            className="block rounded overflow-hidden bg-muted cursor-pointer"
                          >
                            <Image
                              src={back}
                              alt={`${item.cardName} achterkant`}
                              width={40}
                              height={56}
                              className="object-cover w-10 h-14"
                            />
                          </button>
                          <div className="hidden group-hover/back:block absolute left-12 top-1/2 -translate-y-1/2 z-40 rounded-lg shadow-xl overflow-hidden border border-border bg-background">
                            <Image
                              src={back}
                              alt={`${item.cardName} achterkant`}
                              width={200}
                              height={280}
                              className="object-contain"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-medium text-foreground">
                    {item.cardName}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {item.condition}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-foreground">
                    &euro;{item.price.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {item.status === "AVAILABLE" && isLive && !isOwner && hasSession ? (
                      <AddToCartButton itemId={item.id} cardName={item.cardName} />
                    ) : item.status === "CLAIMED" ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                        {t("claimed")}
                      </span>
                    ) : item.status === "SOLD" ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {t("sold")}
                      </span>
                    ) : item.status === "DELETED" && isOwner ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-400">
                        {t("deleted")}
                      </span>
                    ) : item.status !== "DELETED" ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                        {t("available")}
                      </span>
                    ) : null}
                  </td>
                  {isOwner && isLive && (
                    <td className="px-3 py-2 text-center">
                      {item.status !== "SOLD" && item.status !== "DELETED" && (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setEditingItemId(item.id)}
                            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            disabled={deletingItemId === item.id}
                            className="rounded-md p-1 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {filteredItems.length === 0 && (
              <tr>
                <td
                  colSpan={isOwner && isLive ? 6 : 5}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  {ts("noResultsHint")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
