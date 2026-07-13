"use client";

import { useState, useTransition } from "react";
import { Loader2, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { updateBidConfirmationPreference } from "@/actions/profile";

interface Props {
  currentValue: boolean;
}

// Label + uitleg komen sinds Fase 44 uit de omliggende SettingsRow op
// /dashboard/instellingen — dit component is puur de switch + save-status.
// Switch aan = bevestiging vragen (= skipBidConfirmation uit).
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
    <div className="flex items-center gap-2">
      {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      {savedFlash && !isPending && <Check className="h-4 w-4 text-emerald-500" />}
      <Switch
        id="bid-confirmation"
        checked={!skip}
        disabled={isPending}
        onCheckedChange={(checked) => handleToggle(!checked)}
      />
    </div>
  );
}
