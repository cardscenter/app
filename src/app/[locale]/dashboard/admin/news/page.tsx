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
import { PILL_RED, TABLE_CELL, TABLE_HEAD } from "@/components/ploy/tile-styles";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const BTN = PILL_RED;

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
        <DashboardSection title="Berichten" contentClassName="px-0 pb-0 pt-4 sm:px-0 sm:pb-0">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={cn(TABLE_HEAD, "bg-[var(--background)]")}>
              <tr>
                <th className={TABLE_CELL}>Titel</th>
                <th className={TABLE_CELL}>Status</th>
                <th className={TABLE_CELL}>Gepubliceerd</th>
                <th className={TABLE_CELL}>Nieuwsbrief</th>
                <th className={TABLE_CELL}>Auteur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {posts.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-[var(--background)]/60">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/admin/news/${p.id}`} className="font-semibold text-foreground hover:text-primary">
                      {p.pinned && <Pin className="mr-1 inline size-3.5 text-primary" />}
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={p.status === "PUBLISHED" ? "success" : "warning"}>{p.status === "PUBLISHED" ? "Gepubliceerd" : "Concept"}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.publishedAt ? formatEventDateShort(p.publishedAt, "nl") : "·"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.newsletterSentAt ? `${p.newsletterRecipients} ontvangers` : "·"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.author.displayName}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </DashboardSection>
      )}
    </div>
  );
}
