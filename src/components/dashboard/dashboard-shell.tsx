"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Menu, X } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";

// Dashboard-shell (TailAdmin-stijl, sept 2026): één nav-instantie die per
// breakpoint via CSS van off-canvas drawer (mobiel) naar sticky navy kolom
// (md+) gaat — geen dubbele render, geen JS-media-query, dus geen
// hydration-mismatch. De aside draagt class="dark" zodat alle dark:-varianten
// en tokens erbinnen (level-kleuren, amber-pills, AdminNav) automatisch hun
// donkere versie renderen; de sidebar-*-tokens zijn in beide thema's navy.
// Site-header blijft ongemoeid: de hamburger zit bovenin de content-kolom.

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
    closeButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (openedViaButtonRef.current) {
        openedViaButtonRef.current = false;
        openButtonRef.current?.focus();
      }
    };
  }, [open]);

  function openMenu() {
    openedViaButtonRef.current = true;
    setOpen(true);
  }

  return (
    <div className="flex w-full md:flex-row">
      {/* Backdrop — alleen mobiel */}
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("closeMenu")}
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-[60] bg-slate-950/60 transition-opacity md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        id="dashboard-sidebar"
        aria-label={t("navLabel")}
        className={`dark fixed inset-y-0 left-0 z-[70] flex w-[272px] max-w-[85vw] flex-col overflow-y-auto overscroll-contain scrollbar-none bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-out motion-reduce:transition-none ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:sticky md:top-16 md:bottom-auto md:left-auto md:z-auto md:h-[calc(100dvh-4rem)] md:w-[260px] md:max-w-none md:shrink-0 md:translate-x-0 md:self-start md:border-r md:border-sidebar-border md:transition-none xl:top-[72px] xl:h-[calc(100dvh-72px)]`}
      >
        <div className="flex items-center justify-end px-3 pt-3 md:hidden">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("closeMenu")}
            className="grid size-9 place-items-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>
        {nav}
      </aside>

      <div className="min-w-0 flex-1">
        {/* Hamburger-balk — sticky onder de site-header, alleen mobiel */}
        <div className="sticky top-16 z-40 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur md:hidden">
          <button
            ref={openButtonRef}
            type="button"
            onClick={openMenu}
            aria-expanded={open}
            aria-controls="dashboard-sidebar"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Menu className="size-4" />
            {t("openMenu")}
          </button>
        </div>
        <div className="mx-auto max-w-[1620px] px-4 py-5 sm:px-6 md:py-6 lg:px-6">{children}</div>
      </div>
    </div>
  );
}
