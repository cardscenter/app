import { requireStaffPage } from "@/lib/roles-server";

/**
 * Staff-paginaboom (Community Hub): check-in (Fase 3), keuken (Fase 4).
 * Alleen rol STAFF of ADMIN; anderen gaan terug naar het dashboard.
 */
export default async function StaffLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireStaffPage(locale);
  return <>{children}</>;
}
