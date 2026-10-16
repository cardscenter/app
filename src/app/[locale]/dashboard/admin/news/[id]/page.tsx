import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { NewsEditor } from "@/components/admin/news-editor";

export const dynamic = "force-dynamic";

/** Admin: bericht schrijven of bewerken (`nieuw` = leeg formulier). */
export default async function AdminNewsEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const post = id === "nieuw" ? null : await prisma.newsPost.findUnique({ where: { id } });
  if (id !== "nieuw" && !post) notFound();
  const optIn = await prisma.user.count({ where: { newsletterOptIn: true, emailVerifiedAt: { not: null }, deletedAt: null } });
  return (
    <div className="space-y-6">
      <DashboardPageHeader title={post ? post.title : "Nieuw bericht"} subtitle={post ? `/nieuws/${post.slug}` : "Concept opslaan kan altijd; publiceren zet het op de site."} backHref="/dashboard/admin/news" backLabel="Alle berichten" />
      <DashboardSection title="Bericht">
        <NewsEditor row={post ? { ...post, newsletterSentAt: post.newsletterSentAt?.toISOString() ?? null } : null} optInCount={optIn} />
      </DashboardSection>
    </div>
  );
}
