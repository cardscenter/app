"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "lucide-react";
import { HEADER_ICON_BTN } from "./header-styles";

// Hydratie-veilig "mounted"-signaal zonder setState-in-effect: server en
// eerste client-render geven false, daarna true.
const subscribeNoop = () => () => {};
const useMounted = () => useSyncExternalStore(subscribeNoop, () => true, () => false);

// Ronde thema-knop voor de header (één icoon, geen switch — dat blijft de
// ThemeToggle in de footer/instellingen). Toont het icoon van het thema
// waar je NAARTOE gaat, zoals in de referentie: maan = "ga naar donker".
export function ThemeIconButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={HEADER_ICON_BTN}
      aria-label={isDark ? "Schakel naar licht thema" : "Schakel naar donker thema"}
      title={isDark ? "Licht thema" : "Donker thema"}
    >
      {/* Vóór hydratie renderen we de maan zodat er geen icoon-flits is. */}
      {isDark ? <SunIcon className="size-5" aria-hidden /> : <MoonIcon className="size-5" aria-hidden />}
    </button>
  );
}
