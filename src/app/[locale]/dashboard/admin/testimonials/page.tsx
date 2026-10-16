import { Quote, Plus, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { requireAdminPage } from "@/lib/admin";
import { listAllTestimonials } from "@/lib/community/testimonials";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import { TestimonialFlagToggle } from "@/components/admin/testimonial-flag-toggle";

export const dynamic = "force-dynamic";

const BTN = "inline-flex items-center gap-1.5 cc-pill cc-grad px-4 py-2 text-sm font-semibold text-primary-foreground";

const SOURCE_LABEL: Record<string, string> = { GOOGLE: "Google", INSTAGRAM: "Instagram", DISCORD: "Discord", IN_STORE: "In de winkel", EMAIL: "E-mail", OTHER: "Overig" };

/** Admin: ervaringen van spelers voor /ervaringen en de homepage (design-pass Fase C). */
export default async function AdminTestimonialsPage() {
  await requireAdminPage();
  const rows = await listAllTestimonials();
  const approved = rows.filter((r) => r.approved).length;
  const featured = rows.filter((r) => r.approved && r.featured).length;
  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Ervaringen"
        subtitle={`Quotes van spelers voor /ervaringen (${approved} goedgekeurd) en de homepage (${featured} uitgelicht). De homepage toont de rij vanaf drie uitgelichte quotes.`}
        action={
          <Link href="/dashboard/admin/testimonials/nieuw" className={BTN}>
            <Plus className="size-4" /> Nieuwe ervaring
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={Quote} title="Nog geen ervaringen" description="Voeg een quote toe uit een Google-review, een Discord-bericht of een gesprek in de winkel." action={<Link href="/dashboard/admin/testimonials/nieuw" className={BTN}>Nieuwe ervaring</Link>} />
      ) : (
        <DashboardSection title="Quotes" contentClassName="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Quote</th>
                <th className="px-4 py-3 text-left">Van</th>
                <th className="px-4 py-3 text-left">Bron</th>
                <th className="px-4 py-3 text-left">Kleur</th>
                <th className="px-4 py-3 text-left">Zichtbaar</th>
                <th className="px-4 py-3 text-left">Homepage</th>
                <th className="px-4 py-3 text-right">Volgorde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/40">
                  <td className="max-w-md px-4 py-3">
                    <Link href={`/dashboard/admin/testimonials/${r.id}`} className="line-clamp-2 font-medium hover:underline">
                      {r.quote.replace(/\*\*/g, "")}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.authorName}</p>
                    {r.authorRole && <p className="text-xs text-muted-foreground">{r.authorRole}</p>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{SOURCE_LABEL[r.source] ?? r.source}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="inline-block size-3.5 rounded-full border border-border" style={{ background: r.color === "white" ? "#fff" : `var(--pastel-${r.color})` }} />
                      {r.color}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <TestimonialFlagToggle id={r.id} flag="approved" value={r.approved} />
                  </td>
                  <td className="px-4 py-3">
                    <TestimonialFlagToggle id={r.id} flag="featured" value={r.featured} disabled={!r.approved} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {r.featured && r.approved && <Star className="mr-1 inline size-3.5 text-amber-500" />}
                    {r.sortOrder}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <StatusBadge tone="neutral">Tip</StatusBadge> Zet een zinsdeel tussen dubbele sterretjes (**zo**) om het vet te tonen op de muur.
          </p>
        </DashboardSection>
      )}
    </div>
  );
}
