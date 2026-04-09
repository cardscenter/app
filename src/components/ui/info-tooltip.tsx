"use client";

import { Info, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { EscrowInfoModal } from "./escrow-info-modal";

export function EscrowInfoButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        aria-label="Info"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && <EscrowInfoModal onClose={() => setOpen(false)} />}
    </>
  );
}

export function InfoPopup({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <span className="relative inline-flex" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        aria-label="Info"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-xl border border-border bg-popover p-3.5 text-popover-foreground shadow-lg block sm:w-72">
          <span className="flex items-start justify-between gap-2 mb-1.5 block">
            <span className="text-xs font-semibold text-foreground">{title}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="shrink-0 text-muted-foreground/60 hover:text-muted-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
          <span className="text-[11px] leading-relaxed text-muted-foreground block">{text}</span>
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rotate-45 h-3 w-3 border-b border-r border-border bg-popover block" />
        </span>
      )}
    </span>
  );
}
