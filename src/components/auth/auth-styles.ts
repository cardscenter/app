/**
 * Gedeelde klassen voor de auth-formulieren (design-pass): rode pil als
 * primaire knop, witte pil met rand als secundaire, foutblok in pastelroze.
 * Client-importable (alleen strings).
 */
export const AUTH_BTN_PRIMARY =
  "cc-pill cc-grad inline-flex w-full items-center justify-center gap-1.5 px-6 py-4 text-sm font-semibold leading-none text-white disabled:cursor-not-allowed disabled:opacity-60";
export const AUTH_BTN_SECONDARY =
  "cc-pill inline-flex w-full items-center justify-center gap-1.5 border border-[var(--border)] bg-white px-6 py-4 text-sm font-semibold leading-none text-[var(--foreground)] transition-colors hover:bg-[var(--background)] disabled:opacity-60";
export const AUTH_BTN_GHOST = "inline-flex items-center gap-1 text-xs font-semibold text-[var(--foreground)]/55 transition-colors hover:text-[var(--foreground)]";
export const AUTH_ERROR = "flex items-start gap-2 rounded-[12px] px-4 py-3 text-sm text-[var(--foreground)]";
export const AUTH_ERROR_BG = { background: "var(--pastel-pink)" } as const;
export const AUTH_OK = "flex items-start gap-3 rounded-[12px] px-4 py-3 text-sm text-[var(--foreground)]";
export const AUTH_OK_BG = { background: "var(--pastel-green)" } as const;
export const AUTH_LINK = "font-semibold text-[var(--primary)] hover:underline";
