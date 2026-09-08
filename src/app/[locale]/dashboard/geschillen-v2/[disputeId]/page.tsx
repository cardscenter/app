import { redirect } from "next/navigation";

// Legacy-pad (Fase 40 "geschillen-v2"). Sinds de unificatie (2026-09-08) is er
// één geschil-systeem op /dashboard/geschillen/[id]. Oude meldingen/links met
// dit pad blijven werken via deze redirect-stub.
export default async function LegacyDisputeV2Redirect({
  params,
}: {
  params: Promise<{ locale: string; disputeId: string }>;
}) {
  const { locale, disputeId } = await params;
  redirect(`/${locale}/dashboard/geschillen/${disputeId}`);
}
