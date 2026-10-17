"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Menu, X } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";

// Dashboard-shell (design-pass ronde G, 2026-10-17): één nav-instantie die per
// breakpoint via CSS van off-canvas drawer (mobiel) naar een zwevend, afgerond
// donker paneel (md+) gaat: geen dubbele render, geen JS-media-query, dus geen
// hydration-mismatch. Het frame volgt de pil-navigatie (max 1400px, px-4 /
// lg:px-8), zodat zijbalk en inhoud onder de pil uitlijnen. De aside draagt
// class="dark" zodat de sidebar-tokens en eventuele dark:-varianten erbinnen
// hun donkere versie renderen.

type Props = {
  nav: ReactNode;
  children: ReactNode;
};

export function DashboardShell({ nav, children }: Props) {
  const t = useTranslations("dashboard");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openedViaButtonRef = useRef(false);

  // Drawer sluiten bij navigatie (state-sync tijdens render, zoals header.tsx).
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setOpen(false);
  }

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const openButton = openButtonRef.current;
    closeButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (openedViaButtonRef.current) {
        openedViaButtonRef.current = false;
        openButton?.focus();
      }
    };
  }, [open]);

  function openMenu() {
    openedViaButtonRef.current = true;
    setOpen(true);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] gap-6 px-4 pb-12 pt-2 lg:px-8">
      {/* Backdrop: alleen mobiel */}
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("closeMenu")}
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-[60] bg-black/60 transition-opacity md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Kolom: op mobiel display:contents zodat de fixed drawer ongehinderd
          rendert; vanaf md een vaste breedte met een sticky paneel erin. */}
      <div className="contents md:block md:w-[248px] md:shrink-0">
        <aside
          id="dashboard-sidebar"
          aria-label={t("navLabel")}
          className={`dark fixed inset-y-0 left-0 z-[70] flex w-[280px] max-w-[85vw] flex-col overflow-y-auto overscroll-contain scrollbar-none rounded-r-[20px] bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-out motion-reduce:transition-none ${
            open ? "translate-x-0" : "-translate-x-full"
          } md:sticky md:top-[calc(var(--site-nav-offset)+0.5rem)] md:bottom-auto md:left-auto md:z-auto md:h-[calc(100dvh-var(--site-nav-offset)-1.5rem)] md:w-full md:max-w-none md:translate-x-0 md:rounded-[20px] md:transition-none`}
        >
          <div className="flex items-center justify-end px-3 pt-3 md:hidden">
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("closeMenu")}
              className="grid size-9 place-items-center rounded-full text-sidebar-foreground/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="size-5" />
            </button>
          </div>
          {nav}
        </aside>
      </div>

      <div className="min-w-0 flex-1">
        {/* Menu-knop: zwevende pil, sticky onder de site-navigatie, alleen mobiel */}
        <div className="pointer-events-none sticky top-[calc(var(--site-nav-offset)+0.25rem)] z-30 -mt-1 mb-4 md:hidden">
          <button
            ref={openButtonRef}
            type="button"
            onClick={openMenu}
            aria-expanded={open}
            aria-controls="dashboard-sidebar"
            className="cc-pill pointer-events-auto inline-flex items-center gap-2 bg-[var(--cc-dark)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(0,0,0,0.5)]"
          >
            <Menu className="size-4" />
            {t("openMenu")}
          </button>
        </div>
        <div className="pt-1 md:pt-2">{children}</div>
      </div>
    </div>
  );
}
