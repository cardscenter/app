/**
 * Client-side voorkeuren in localStorage (Fase 44 — /dashboard/instellingen).
 * Voor lichte UI-voorkeuren die geen DB-veld verdienen. Wijzigingen worden
 * ge-broadcast via een CustomEvent zodat live componenten (header-saldo,
 * toast-listener) direct meebewegen zonder refresh.
 */

export const PREF_HIDE_BALANCE = "pref-hide-balance";
export const PREF_ACHIEVEMENT_TOASTS = "pref-achievement-toasts";

export const LOCAL_PREF_EVENT = "local-pref-changed";

export function getLocalPref(key: string, defaultValue: boolean): boolean {
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return raw === "1";
  } catch {
    return defaultValue;
  }
}

export function setLocalPref(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? "1" : "0");
    window.dispatchEvent(
      new CustomEvent(LOCAL_PREF_EVENT, { detail: { key, value } })
    );
  } catch {
    // localStorage niet beschikbaar — voorkeur gaat verloren, geen crash
  }
}

/** Abonneer op wijzigingen van één pref-key. Retourneert unsubscribe. */
export function onLocalPrefChange(
  key: string,
  handler: (value: boolean) => void
): () => void {
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<{ key: string; value: boolean }>).detail;
    if (detail?.key === key) handler(detail.value);
  };
  window.addEventListener(LOCAL_PREF_EVENT, listener);
  return () => window.removeEventListener(LOCAL_PREF_EVENT, listener);
}
