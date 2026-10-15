"use client";

import type { ReactNode } from "react";
import { Flame } from "lucide-react";
import { SPICE_MAX } from "@/lib/food/menu-data";
import { formatEuro } from "@/lib/food/pricing";

/** Vaste gradient-knop (rood) en ghost-knop uit het prototype. */
export function Btn({ children, onClick, variant = "primary", disabled, className = "", type = "button" }: { children: ReactNode; onClick?: () => void; variant?: "primary" | "ghost"; disabled?: boolean; className?: string; type?: "button" | "submit" }) {
  const base = "inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-[15px] font-semibold transition active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-45";
  const v = variant === "primary" ? "btn-grad shadow-[0_8px_20px_rgba(197,26,37,.25)]" : "border border-[var(--line)] bg-white text-[var(--ink)] hover:bg-[var(--wash)]";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${v} ${className}`}>
      {children}
    </button>
  );
}

export function Chip({ children, active, onClick, disabled, className = "" }: { children: ReactNode; active?: boolean; onClick?: () => void; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition disabled:opacity-40 ${
        active ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--line)] bg-white text-[var(--ink)] hover:bg-[var(--wash)]"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="block text-[11px] font-bold uppercase tracking-[.12em] text-[var(--ink-3)]">{children}</span>;
}

/** Pepertjes: eerste n rood, de rest grijs. */
export function Spice({ n, label }: { n: number | null | undefined; label?: string }) {
  if (!n) return null;
  return (
    <span className="inline-flex items-center gap-px" role="img" aria-label={label} title={label}>
      {Array.from({ length: SPICE_MAX }, (_, k) => (
        <Flame key={k} className={`size-3.5 ${k < n ? "fill-[var(--red)] text-[var(--red)]" : "text-[#D9D6D9]"}`} />
      ))}
    </span>
  );
}

export function Price({ amount, locale, className = "" }: { amount: number; locale: string; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{formatEuro(amount, locale)}</span>;
}

/** Donkere bovenbalk met het chef-logo, taalknoppen en een terugknop. */
export function TopBar({ onBack, lang, onLang }: { onBack?: (() => void) | null; lang: string; onLang: (l: "nl" | "en") => void }) {
  return (
    <header className="sticky top-0 z-40 bg-[var(--ink)] text-white">
      <div className="mx-auto flex h-14 max-w-[var(--app-w,440px)] items-center gap-2 px-3">
        {onBack ? (
          <button type="button" onClick={onBack} aria-label="Terug" className="flex size-10 items-center justify-center rounded-full hover:bg-white/10">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
        ) : (
          <span className="w-10" />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo-chef-web.png" alt="Cards Center" className="mx-auto h-8 w-auto" />
        <div className="flex gap-1">
          {(["nl", "en"] as const).map((l) => (
            <button key={l} type="button" onClick={() => onLang(l)} aria-pressed={lang === l} className={`rounded-md px-2 py-1 text-xs font-bold uppercase ${lang === l ? "bg-white text-[var(--ink)]" : "text-white/70 hover:text-white"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

export function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4">
      <div className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white shadow-lg">{msg}</div>
    </div>
  );
}

export const ICON_SIZE = "size-[18px]";
