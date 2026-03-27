"use client";

import { Link } from "@/i18n/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";

export function UserBalance() {
  const { status } = useSession();
  const [balance, setBalance] = useState<number | null>(null);

  const fetchBalance = useCallback(() => {
    fetch("/api/balance")
      .then((res) => res.json())
      .then((data) => {
        if (data.balance !== null && data.balance !== undefined) {
          setBalance(data.balance);
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

  return (
    <Link
      href="/dashboard"
      className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/20"
      title="Saldo"
    >
      {/* Wallet icon */}
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
      </svg>
      <span>
        {balance !== null ? `€${balance.toFixed(2)}` : "..."}
      </span>
    </Link>
  );
}
