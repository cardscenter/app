"use client";

import { useId, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { MoonIcon, SunIcon } from "lucide-react";

export function ThemeToggle() {
  const id = useId();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  function handleChange(dark: boolean) {
    setTheme(dark ? "dark" : "light");
  }

  return (
    <div className="group inline-flex items-center gap-2">
      <span
        id={`${id}-light`}
        className={cn(
          "cursor-pointer text-left text-sm font-medium",
          isDark && "text-foreground/50",
        )}
        aria-controls={id}
        onClick={() => handleChange(false)}
      >
        <SunIcon className="size-4" aria-hidden="true" />
      </span>

      <Switch
        id={id}
        checked={isDark}
        onCheckedChange={handleChange}
        aria-labelledby={`${id}-light ${id}-dark`}
        aria-label="Toggle between dark and light mode"
      />

      <span
        id={`${id}-dark`}
        className={cn(
          "cursor-pointer text-right text-sm font-medium",
          isDark || "text-foreground/50",
        )}
        aria-controls={id}
        onClick={() => handleChange(true)}
      >
        <MoonIcon className="size-4" aria-hidden="true" />
      </span>
    </div>
  );
}
