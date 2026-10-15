import { createFeatureLayout } from "@/lib/feature-flags-server";

// Feature-flag-guard (Community Hub, Fase 1): hele boom uit zolang FEATURE_MARKETPLACE uit staat.
export default createFeatureLayout("FEATURE_MARKETPLACE");
