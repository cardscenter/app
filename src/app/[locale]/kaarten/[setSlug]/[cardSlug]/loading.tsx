import { PageContainer } from "@/components/layout/page-container";
import { RouteLoadingIndicator } from "@/components/ui/route-loading-indicator";

// Instant feedback bij navigatie naar een kaart: draaiend logo + indicatief
// percentage + roterende Pokémon-weetjes (leuk tijdens een cold load).
export default function CardDetailLoading() {
  return (
    <PageContainer width="default" className="py-8">
      <RouteLoadingIndicator />
    </PageContainer>
  );
}
