"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Switch } from "@/components/ui/switch";
import {
  getLocalPref,
  onLocalPrefChange,
  setLocalPref,
} from "@/lib/local-preferences";

const noopSubscribe = () => () => {};

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
  // Server- en hydratie-render gebruiken de default; daarna leest de
  // store localStorage — voorkomt hydration-mismatch.
  const subscribe = useCallback(
    (onChange: () => void) => onLocalPrefChange(prefKey, onChange),
    [prefKey]
  );
  const checked = useSyncExternalStore(
    subscribe,
    () => getLocalPref(prefKey, defaultValue),
    () => defaultValue
  );
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  function handleChange(value: boolean) {
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
