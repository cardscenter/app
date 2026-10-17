"use client";

import { useSyncExternalStore } from "react";
import { Toaster } from "sonner";

const DESKTOP_QUERY = "(min-width: 768px)";

function subscribeDesktop(onChange: () => void) {
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * Toaster die op desktop top-right toont en op mobile bottom-center —
 * volgt de OS/app-conventies waar gebruikers toasts verwachten.
 */
export function ResponsiveToaster() {
  // Server/hydratie-render = mobile; daarna de echte media-query.
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false
  );

  return <Toaster position={isDesktop ? "top-right" : "bottom-center"} richColors />;
}
