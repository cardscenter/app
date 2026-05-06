"use client";

import { useState, useTransition } from "react";
import { Loader2, Check } from "lucide-react";
import { updateBidConfirmationPreference } from "@/actions/profile";
import { AUCTION_BUYER_PREMIUM_RATE } from "@/lib/auction/fees";

const PREMIUM_LABEL = `${(AUCTION_BUYER_PREMIUM_RATE * 100).toFixed(1).replace(/\.0$/, "").replace(".", ",")}%`;

interface Props {
  currentValue: boolean;
}

export function BidConfirmationToggle({ currentValue }: Props) {
  const [skip, setSkip] = useState(currentValue);
  const [isPending, startTransition] = useTransition();
  const [savedFlash, setSavedFlash] = useState(false);

  const handleToggle = (newValue: boolean) => {
    setSkip(newValue);
    startTransition(async () => {
      const result = await updateBidConfirmationPreference(newValue);
      if ("success" in result && result.success) {
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2500);
      } else {
        setSkip(!newValue);
      }
    });
  };

  return (
    <div className="space-y-2">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={!skip}
          onChange={(e) => handleToggle(!e.target.checked)}
          disabled={isPending}
          className="mt-1 h-4 w-4 accent-primary"
        />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            Bevestiging vragen vóór elk veiling-bod
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            We tonen standaard bij je eerste bod op een veiling een overzicht met de totale kosten (bod + {PREMIUM_LABEL} veilingkosten + reserve). Zet je deze uit, dan plaatst je bod direct.
          </p>
        </div>
        {isPending && <Loader2 className="mt-1 h-4 w-4 animate-spin text-muted-foreground" />}
        {savedFlash && !isPending && <Check className="mt-1 h-4 w-4 text-emerald-500" />}
      </label>
    </div>
  );
}
