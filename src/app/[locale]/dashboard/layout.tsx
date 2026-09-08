import { DashboardChrome } from "@/components/dashboard/dashboard-chrome";

// TailAdmin-stijl (sept 2026): het frame (auth, navy sidebar, banners) zit in
// DashboardChrome zodat /berichten hetzelfde frame kan hergebruiken.
export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <DashboardChrome locale={locale}>{children}</DashboardChrome>;
}
