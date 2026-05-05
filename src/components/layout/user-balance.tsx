"use client";

import { Link } from "@/i18n/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRealtime } from "@/components/providers/realtime-provider";

export function UserBalance() {
  const { status } = useSession();
  const [balance, setBalance] = useState<number | null>(null);
  const [reservedBalance, setReservedBalance] = useState<number>(0);
  const [availableBalance, setAvailableBalance] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { subscribe } = useRealtime();

  const fetchBalance = useCallback(() => {
    fetch("/api/balance")
      .then((res) => res.json())
      .then((data) => {
        if (data.balance !== null && data.balance !== undefined) {
          setBalance(data.balance);
          setReservedBalance(data.reservedBalance ?? 0);
          setAvailableBalance(data.availableBalance ?? data.balance);
        }
      })
      .catch(() => {
        // Silently ignore fetch errors
      });
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchBalance();
    }
  }, [status, fetchBalance]);

  // Refresh on window focus
  useEffect(() => {
    function handleFocus() {
      if (status === "authenticated") {
        fetchBalance();
      }
    }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [status, fetchBalance]);

  // Real-time balance-updates via SSE — refetch zodra een action server-side
  // een balance-changed event publishet (bid, escrow, deposit, withdraw, refund).
  useEffect(() => {
    if (status !== "authenticated") return;
    return subscribe("balance-changed", () => fetchBalance());
  }, [status, subscribe, fetchBalance]);

  // Close on click-outside + Escape — alleen relevant in mobile-mode (click-toggle)
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const hasReserve = balance !== null && reservedBalance > 0;
  const totalLabel = balance !== null ? `€${balance.toFixed(2)}` : "...";
  const reservedLabel = `€${reservedBalance.toFixed(2)}`;
  const availableLabel = availableBalance !== null ? `€${availableBalance.toFixed(2)}` : "...";

  return (
    // Wrapper vangt hover voor pill ÉN popover. Belangrijk: zonder gap tussen
    // beide elementen — de popover gebruikt `pt-2` (padding) i.p.v. `mt-2`
    // (margin) zodat de muis nooit "in het niets" valt op weg van pill naar
    // popover. PointerLeave op deze wrapper triggert pas als de muis écht
    // buiten de combinatie van pill + popover komt.
    <div
      ref={containerRef}
      className="relative shrink-0"
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") setOpen(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex items-center gap-1.5 whitespace-nowrap rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/20"
      >
        {/* Wallet icon */}
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
        </svg>
        <span>{availableLabel}</span>
        {hasReserve && (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3 w-3 opacity-70">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
        )}
      </button>

      {open && balance !== null && (
        // Outer is de hover-bridge: pt-2 (padding) zorgt voor visuele gap
        // ZONDER een 8px-gat in de DOM-tree waar de muis kan verdwalen.
        <div role="dialog" className="absolute right-0 top-full z-50 pt-2">
          <div className="w-80 max-w-[calc(100vw-1rem)] rounded-xl border border-border bg-card p-3 text-sm text-foreground shadow-lg shadow-black/10">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Saldo-overzicht
              </p>
              {hasReserve && (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  {reservedLabel} gereserveerd
                </span>
              )}
            </div>

            <ul className="space-y-1.5">
              {/* Beschikbaar — primary card (zoals een ongelezen melding) */}
              <li className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 ring-1 ring-emerald-500/10">
                <div className="flex items-start gap-2">
                  <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Beschikbaar om uit te geven
                    </p>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {availableLabel}
                    </p>
                  </div>
                </div>
              </li>

              {/* Vastgehouden — alleen tonen als > 0, met amber-accent */}
              {hasReserve && (
                <li className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 ring-1 ring-amber-500/10">
                  <div className="flex items-start gap-2">
                    <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                        Vastgehouden voor biedingen
                      </p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                        {reservedLabel}
                      </p>
                      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                        10% van elk actief bod, valt vrij bij overbieden.
                      </p>
                    </div>
                  </div>
                </li>
              )}

              {/* Totaal — neutrale card */}
              <li className="rounded-lg border border-transparent bg-muted/30 p-2.5">
                <div className="flex items-start gap-2">
                  <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Totaal saldo
                    </p>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                      {totalLabel}
                    </p>
                  </div>
                </div>
              </li>
            </ul>

            <Link
              href="/dashboard/saldo"
              onClick={() => setOpen(false)}
              className="mt-3 block w-full rounded-md bg-primary px-3 py-2 text-center text-xs font-medium text-white hover:bg-primary-hover"
            >
              Bekijk saldo en transacties
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
