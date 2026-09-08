"use client";

import { useEffect } from "react";

/**
 * Body-scroll-lock zolang `locked` true is (drawers/modals op mobiel).
 * iOS Safari accepteert geen simpele overflow:hidden — position:fixed met
 * behouden scrollY is de werkende combo (zelfde patroon als de
 * pricing-helper-modal). Herstelt de originele styles + scrollpositie.
 */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked || typeof document === "undefined") return;
    const body = document.body;
    const original = {
      overflow: body.style.overflow,
      position: body.style.position,
      width: body.style.width,
      top: body.style.top,
    };
    const scrollY = window.scrollY;
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.width = "100%";
    body.style.top = `-${scrollY}px`;
    return () => {
      body.style.overflow = original.overflow;
      body.style.position = original.position;
      body.style.width = original.width;
      body.style.top = original.top;
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}
