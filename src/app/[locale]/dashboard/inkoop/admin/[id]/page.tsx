import { redirect } from "@/i18n/navigation";

export default async function Stub({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  redirect({ href: `/dashboard/admin/buybacks/${id}`, locale });
}
