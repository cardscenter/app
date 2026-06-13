import { PageContainer } from "@/components/layout/page-container";
import { RouteLoadingIndicator } from "@/components/ui/route-loading-indicator";

// Laad-feedback voor de kaarten-database-lijst (zwaarste cold load).
export default function CardsOverviewLoading() {
  return (
    <PageContainer width="wide" className="py-8">
      <RouteLoadingIndicator />
    </PageContainer>
  );
}
