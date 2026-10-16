import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { TestimonialEditor } from "@/components/admin/testimonial-editor";

export const dynamic = "force-dynamic";

/** Admin: ervaring toevoegen of bewerken (`nieuw` = leeg formulier). */
export default async function AdminTestimonialEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const row = id === "nieuw" ? null : await prisma.shopTestimonial.findUnique({ where: { id } });
  if (id !== "nieuw" && !row) notFound();
  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={row ? `Ervaring van ${row.authorName}` : "Nieuwe ervaring"}
        subtitle={row ? "Wijzigingen staan direct op /ervaringen en de homepage." : "Een quote uit een review, een bericht of een gesprek in de winkel. Vraag de speler altijd om toestemming voordat je zijn naam gebruikt."}
        backHref="/dashboard/admin/testimonials"
        backLabel="Alle ervaringen"
      />
      <DashboardSection title="Ervaring">
        <TestimonialEditor row={row} />
      </DashboardSection>
    </div>
  );
}
