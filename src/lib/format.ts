/**
 * Gedeelde datum/geld-formatters voor het dashboard (Fase 44). Vervangt de
 * ad-hoc inline `toLocaleDateString`/`€${x.toFixed(2)}`-patronen. Bewust los
 * van `src/lib/events/format.ts` — de ticket-notatie ("€5,-" / "Gratis") is
 * event-domein-specifiek.
 */

export function formatCurrency(amount: number, locale = "nl-NL"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function formatDate(d: Date | string, locale = "nl-NL"): string {
  return new Date(d).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateShort(d: Date | string, locale = "nl-NL"): string {
  return new Date(d).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(d: Date | string, locale = "nl-NL"): string {
  return new Date(d).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
