import { Newspaper, Plus, Pin } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin";
import { listAllNews } from "@/lib/community/news";
import { formatEventDateShort } from "@/lib/shop-events/format";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";

export const dynamic = "force-dynamic";

const BTN = "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover";

/** Admin: nieuwsberichten (concept/gepubliceerd) + nieuwsbrief-status. */
export default async function AdminNewsPage() {
  await requireAdminPage();
  const [posts, optIn] = await Promise.all([listAllNews(), prisma.user.count({ where: { newsletterOptIn: true, emailVerifiedAt: { not: null }, deletedAt: null } })]);
  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Nieuws"
        subtitle={`Berichten voor /nieuws. Gepubliceerde berichten kun je één keer als nieuwsbrief sturen naar leden met opt-in (nu ${optIn}).`}
        action={
          <Link href="/dashboard/admin/news/nieuw" className={BTN}>
            <Plus className="size-4" /> Nieuw bericht
          </Link>
        }
      />
      {posts.length === 0 ? (
        <EmptyState icon={Newspaper} title="Nog geen berichten" description="Schrijf het eerste bericht: een aankondiging, een nieuwe set of de openingsdatum." action={<Link href="/dashboard/admin/news/nieuw" className={BTN}>Nieuw bericht</Link>} />
      ) : (
        <DashboardSection title="Berichten" contentClassName="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Titel</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Gepubliceerd</th>
                <th className="px-4 py-3 text-left">Nieuwsbrief</th>
                <th className="px-4 py-3 text-left">Auteur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {posts.map((p) => (
                <tr key={p.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/admin/news/${p.id}`} className="font-medium hover:underline">
                      {p.pinned && <Pin className="mr-1 inline size-3.5 text-amber-500" />}
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={p.status === "PUBLISHED" ? "success" : "warning"}>{p.status === "PUBLISHED" ? "Gepubliceerd" : "Concept"}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.publishedAt ? formatEventDateShort(p.publishedAt, "nl") : "–"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.newsletterSentAt ? `${p.newsletterRecipients} ontvangers` : "–"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.author.displayName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DashboardSection>
      )}
    </div>
  );
}
