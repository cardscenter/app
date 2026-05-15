"use client";

import { useState, forwardRef } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PasswordInputProps extends Omit<React.ComponentProps<"input">, "type"> {
  /** Visuele groot-modus voor auth-pages (h-11 + grotere typografie). Default true. */
  large?: boolean;
}

/**
 * Wachtwoord-input met show/hide-toggle (Fase 37).
 * Eye-icoon rechts toggleen tussen type=password en type=text.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, large = true, ...props }, ref) {
    const [visible, setVisible] = useState(false);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn(large && "h-11 pr-11 text-sm", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Verberg wachtwoord" : "Toon wachtwoord"}
          tabIndex={-1}
          className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    );
  },
);
