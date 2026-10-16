"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Licht-only sinds de design-pass (2026-10, Ploy-stijl): `forcedTheme` zet
 * `<html class="light">` ongeacht een eerder opgeslagen "dark" in localStorage.
 * Het `.dark`-tokenblok in globals.css blijft bestaan voor de dashboard-zijbalk
 * (die draagt zelf class="dark").
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      forcedTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      scriptProps={{ nonce: "theme" }}
    >
      {children}
    </NextThemesProvider>
  );
}
