"use client";

import { createContext, useContext } from "react";
import { emptyFeatureSnapshot, type FeatureFlag, type FeatureSnapshot } from "@/lib/feature-flags";

/**
 * Per-bezoeker feature-snapshot voor client-components (Community Hub, Fase 1).
 * Gevuld in `src/app/[locale]/layout.tsx` via `getFeatureSnapshot(accountType)`;
 * admins krijgen overal `true`. Buiten de provider: alles uit.
 */
const FeatureFlagsContext = createContext<FeatureSnapshot>(emptyFeatureSnapshot());

export function FeatureFlagsProvider({
  value,
  children,
}: {
  value: FeatureSnapshot;
  children: React.ReactNode;
}) {
  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}

export function useFeatureFlags(): FeatureSnapshot {
  return useContext(FeatureFlagsContext);
}

export function useFeature(flag: FeatureFlag): boolean {
  return useContext(FeatureFlagsContext)[flag];
}
