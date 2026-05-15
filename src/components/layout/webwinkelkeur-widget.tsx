import { getWebwinkelkeurSummary } from "@/lib/webwinkelkeur";
import { WebwinkelkeurBadge } from "@/components/layout/webwinkelkeur-badge";

/**
 * Server-side wrapper: haalt de rating-summary op (gecached 1u),
 * en delegate de UI + click-to-popup naar de client `WebwinkelkeurBadge`.
 *
 * Returnt null als de API faalt — geen badge ipv broken UI.
 */
export async function WebwinkelkeurWidget() {
  const summary = await getWebwinkelkeurSummary();
  if (!summary) return null;
  return <WebwinkelkeurBadge summary={summary} />;
}
