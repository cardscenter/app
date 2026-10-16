"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Prompt-/codekaart (referentie cli-pagina): monospace-inhoud met een
 * kopieer-knop. `tone="dark"` voor het zwarte codeblok (ticketcode, QR).
 */
export function PromptCard({ label, value, copyLabel, copiedLabel, tone = "light", children, className = "" }: { label?: string; value: string; copyLabel: string; copiedLabel: string; tone?: "light" | "dark"; children?: ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const dark = tone === "dark";
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard niet beschikbaar (http/permissions): stil negeren */
    }
  }
  return (
    <div className={`overflow-hidden rounded-[12px] ${dark ? "bg-[var(--foreground)] text-white" : "bg-white text-[var(--foreground)] shadow-[0_2px_8px_0_var(--cc-border-subtle)]"} ${className}`}>
      <div className={`flex items-center justify-between gap-4 px-5 py-3 ${dark ? "border-b border-white/10" : "border-b border-[var(--border)]"}`}>
        <span className="text-sm font-semibold">{label}</span>
        <button type="button" onClick={copy} className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors ${dark ? "bg-white/10 hover:bg-white/20" : "bg-[var(--background)] hover:bg-[var(--muted)]"}`}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
      <div className="px-5 py-5">
        {children ?? <code className="block whitespace-pre-wrap font-mono text-[15px] leading-relaxed">{value}</code>}
      </div>
    </div>
  );
}
