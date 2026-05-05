"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";

/**
 * Toaster die op desktop top-right toont en op mobile bottom-center —
 * volgt de OS/app-conventies waar gebruikers toasts verwachten.
 */
export function ResponsiveToaster() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return <Toaster position={isDesktop ? "top-right" : "bottom-center"} richColors />;
}
