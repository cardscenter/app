import { Flag } from "lucide-react";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import { FEATURE_FLAGS, FEATURE_FLAG_KEYS, isFeatureEnabled } from "@/lib/feature-flags";

/**
 * Read-only overzicht van de feature-flags (Community Hub, Fase 1) op
 * /dashboard/admin/config. De flags komen uit de omgevingsvariabelen van de
 * Railway-service (lokaal: .env); ze zijn hier bewust niet te wijzigen, zodat
 * "handel aan/uit" een bewuste deploy-keuze blijft en geen klik.
 */
export function FeatureFlagsPanel() {
  const rows = FEATURE_FLAG_KEYS.map((key) => {
    const meta = FEATURE_FLAGS[key];
    const raw = process.env[key];
    const effective = isFeatureEnabled(key);
    // Eigen env-waarde staat aan maar een vereiste flag niet: laat zien welke.
    const missingRequirement =
      !effective && raw ? ((meta.requires ?? []).find((r) => !isFeatureEnabled(r)) ?? null) : null;
    return { key, meta, raw: raw ?? "", effective, missingRequirement };
  });

  return (
    <DashboardSection
      title="Feature-flags"
      description="Omgevingsvariabelen van de service (niet hier te wijzigen). Uit = verborgen voor iedereen, ook voor admins. Wijzigen: Railway-service Variables (of lokaal .env) en herstarten."
      icon={<Flag className="size-4" />}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Flag</th>
              <th className="px-4 py-3 text-left font-medium">Omschrijving</th>
              <th className="px-4 py-3 text-left font-medium">Env-waarde</th>
              <th className="px-4 py-3 text-left font-medium">Effectief</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="px-4 py-3 align-top">
                  <code className="font-mono text-xs font-semibold">{r.key}</code>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.meta.label}</p>
                </td>
                <td className="px-4 py-3 align-top text-muted-foreground">
                  {r.meta.description}
                  {r.meta.requires && r.meta.requires.length > 0 && (
                    <p className="mt-1 text-xs">
                      Vereist: {r.meta.requires.map((x) => <code key={x} className="font-mono">{x}</code>)}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 align-top">
                  <code className="font-mono text-xs">{r.raw || "(leeg)"}</code>
                </td>
                <td className="px-4 py-3 align-top">
                  <StatusBadge tone={r.effective ? "success" : "neutral"}>
                    {r.effective ? "aan" : "uit"}
                  </StatusBadge>
                  {r.missingRequirement && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      Staat aan in de env, maar {r.missingRequirement} is uit.
                    </p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardSection>
  );
}
