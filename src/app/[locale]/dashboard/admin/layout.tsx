import { requireAdminPage } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { ShieldAlert } from "lucide-react";
import { Callout } from "@/components/dashboard/ui/callout";
import { PILL_RED } from "@/components/ploy/tile-styles";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { adminId } = await requireAdminPage();

  // 2FA verplicht voor admins (Fase 16-followup): zonder ingeschakelde 2FA
  // geen toegang tot het panel — instructiescherm i.p.v. children. De
  // action-laag (requireAdmin) heeft dezelfde check als defense-in-depth.
  const me = await prisma.user.findUnique({
    where: { id: adminId },
    select: { totpEnabled: true },
  });
  if (!me?.totpEnabled) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16">
        <h1 className="cc-display text-[32px] text-foreground lg:text-[40px]">
          2FA verplicht
        </h1>
        <Callout
          tone="yellow"
          icon={ShieldAlert}
          title="Twee-factor-authenticatie is verplicht voor admin-toegang"
        >
          Admin-accounts kunnen saldo&apos;s, uitbetalingen en gebruikers beheren.
          Daarom is twee-factor-authenticatie verplicht voordat je het
          admin-panel kunt gebruiken. Instellen duurt een minuut: QR-code
          scannen met een authenticator-app en klaar.
        </Callout>
        <Link href="/dashboard/profiel" className={PILL_RED}>
          2FA instellen op mijn profiel
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
