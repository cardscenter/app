"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Save, X } from "lucide-react";
import { updateClaimsaleItem } from "@/actions/claimsale";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ClaimsaleItemEditProps {
  itemId: string;
  initialCardName: string;
  initialCondition: string;
  initialPrice: number;
  onClose: () => void;
}

const CONDITIONS = ["Near Mint", "Excellent", "Good", "Light Played", "Heavy Played", "Poor"];

export function ClaimsaleItemEdit({
  itemId,
  initialCardName,
  initialCondition,
  initialPrice,
  onClose,
}: ClaimsaleItemEditProps) {
  const t = useTranslations("claimsale");
  const [cardName, setCardName] = useState(initialCardName);
  const [condition, setCondition] = useState(initialCondition);
  const [price, setPrice] = useState(initialPrice.toString());
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSave() {
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error("Ongeldige prijs");
      return;
    }

    setSaving(true);
    const result = await updateClaimsaleItem(itemId, {
      cardName: cardName.trim(),
      condition,
      price: priceNum,
    });

    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(t("itemSaved"));
      router.refresh();
      onClose();
    }
    setSaving(false);
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={cardName}
          onChange={(e) => setCardName(e.target.value)}
          placeholder={t("cardName")}
          className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
        <select
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        >
          {CONDITIONS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">&euro;</span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-24 rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
        </div>
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50 transition-colors"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "..." : t("save")}
        </button>
      </div>
    </div>
  );
}