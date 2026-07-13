"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { getLocalPref, setLocalPref } from "@/lib/local-preferences";

/**
 * Switch gebonden aan een localStorage-voorkeur (Fase 44). Gebruikt binnen
 * een SettingsRow op /dashboard/instellingen. `defaultValue` is de waarde
 * zolang de user nooit heeft getoggled.
 */
export function LocalPrefToggle({
  prefKey,
  defaultValue,
  id,
}: {
  prefKey: string;
  defaultValue: boolean;
  id?: string;
}) {
  // Start op default en lees localStorage pas na mount — voorkomt
  // hydration-mismatch tussen server- en client-render.
  const [checked, setChecked] = useState(defaultValue);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setChecked(getLocalPref(prefKey, defaultValue));
    setMounted(true);
  }, [prefKey, defaultValue]);

  function handleChange(value: boolean) {
    setChecked(value);
    setLocalPref(prefKey, value);
  }

  return (
    <Switch
      id={id}
      checked={checked}
      onCheckedChange={handleChange}
      disabled={!mounted}
    />
  );
}
