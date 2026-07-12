import { requireAdminPage } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { ShieldAlert } from "lucide-react";

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
      <div className="mx-auto max-w-lg py-16">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
            <ShieldAlert className="size-7" />
          </div>
          <h1 className="text-xl font-bold text-foreground">
            2FA verplicht voor admin-toegang
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Admin-accounts kunnen saldo&apos;s, uitbetalingen en gebruikers beheren —
            daarom is twee-factor-authenticatie verplicht voordat je het
            admin-panel kunt gebruiken. Instellen duurt een minuut: QR-code
            scannen met een authenticator-app en klaar.
          </p>
          <Link
            href="/dashboard/profiel"
            className="mt-6 inline-flex items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            2FA instellen op mijn profiel
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
