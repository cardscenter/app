import QRCode from "qrcode";
import { QrCode, Printer } from "lucide-react";
import { requireAdminPage } from "@/lib/admin";
import { getSiteUrl } from "@/lib/site-url";
import { TABLE_MAX, TABLE_MIN } from "@/lib/food/menu-data";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";

export const dynamic = "force-dynamic";

/**
 * QR-codes voor de tafelkaartjes (tafel 1 t/m 16) en de bar. Print via de
 * browser (Ctrl+P): elke kaart "Bestel hier" + QR + "wij ruimen af".
 */
export default async function QrCodesPage() {
  await requireAdminPage();
  const base = getSiteUrl();
  const targets = [
    ...Array.from({ length: TABLE_MAX - TABLE_MIN + 1 }, (_, i) => ({ label: `Tafel ${i + TABLE_MIN}`, url: `${base}/nl/bestellen?tafel=${i + TABLE_MIN}`, sub: "Na het eten ruimen wij af. Laat je dienblad gerust staan." })),
    { label: "Bar", url: `${base}/nl/bestellen?modus=bar`, sub: "Bestel op naam en haal het op aan de bar." },
  ];
  const cards = await Promise.all(targets.map(async (t) => ({ ...t, qr: await QRCode.toDataURL(t.url, { errorCorrectionLevel: "M", margin: 1, width: 360, color: { dark: "#1F1F22", light: "#FFFFFF" } }) })));

  return (
    <div className="space-y-6">
      <style>{`@media print { body * { visibility: hidden; } #qr-print, #qr-print * { visibility: visible; } #qr-print { position: absolute; inset: 0; padding: 0; } .qr-card { break-inside: avoid; } }`}</style>
      <DashboardPageHeader
        title="QR-codes tafels en bar"
        subtitle={`Elke code opent de bestelapp op ${base}/nl/bestellen met het tafelnummer in de link. Print deze pagina (Ctrl+P) voor de tafelkaartjes.`}
        action={<span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Printer className="size-4" /> Ctrl+P om te printen</span>}
      />
      <DashboardSection title="Kaartjes" icon={<QrCode className="size-5" />}>
        <div id="qr-print" className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="qr-card flex flex-col items-center rounded-[16px] border-2 border-[#1F1F22] bg-white p-4 text-center text-[#1F1F22]">
              <span className="text-[11px] font-bold uppercase tracking-[.14em]">Cards Center</span>
              <span className="mt-1 text-2xl font-extrabold">Bestel hier</span>
              <span className="text-sm font-semibold">{c.label}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.qr} alt={`QR ${c.label}`} className="mt-3 size-40" />
              <span className="mt-3 text-[11px] text-[#5E5C61]">{c.sub}</span>
              <span className="mt-1 break-all font-mono text-[9px] text-[#8E8A90]">{c.url}</span>
            </div>
          ))}
        </div>
      </DashboardSection>
    </div>
  );
}
