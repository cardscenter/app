import { createFeatureLayout } from "@/lib/feature-flags-server";

// Kaartendatabase verborgen tot de handel terugkomt (ronde G, 2026-10-17).
export default createFeatureLayout("FEATURE_CARD_DATABASE");
