import { UtensilsCrossed, Ticket } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin";
import { getMenu } from "@/lib/food/menu-server";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { MenuAdmin, DiscountCodesAdmin } from "@/components/admin/menu-admin";

export const dynamic = "force-dynamic";

/** Admin: menu (prijzen, aan/uit, uitverkocht, teksten) en kortingscodes. */
export default async function AdminMenuPage() {
  await requireAdminPage();
  const [menu, codes] = await Promise.all([getMenu({ includeDisabled: true }), prisma.discountCode.findMany({ orderBy: { createdAt: "asc" } })]);
  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Menu en kortingscodes"
        subtitle="Het assortiment van de bestelapp. Prijzen zijn placeholders tot ze definitief zijn. Uitverkocht zet de keuken normaal zelf; hier kan het ook. Nieuwe producten (en foto's) voeg ik toe in de seed, zeg het als er iets bij moet."
      />
      <DashboardSection title="Menu" icon={<UtensilsCrossed className="size-5" />} contentClassName="px-0 pb-0 pt-4 sm:px-0 sm:pb-0">
        <MenuAdmin categories={menu.categories} items={menu.items} />
      </DashboardSection>
      <DashboardSection title="Kortingscodes" icon={<Ticket className="size-5" />} description="Code op het betaalscherm. Procent of vast bedrag, optioneel met vervaldatum en maximaal aantal keer.">
        <DiscountCodesAdmin codes={codes.map((c) => ({ code: c.code, type: c.type as "PCT" | "EUR", value: c.value, enabled: c.enabled, expiresAt: c.expiresAt?.toISOString().slice(0, 10) ?? "", maxUses: c.maxUses, uses: c.uses }))} />
      </DashboardSection>
    </div>
  );
}
