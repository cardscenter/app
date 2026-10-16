import { requireStaffPage } from "@/lib/roles-server";

/**
 * Keuken & bar (Community Hub, Fase 4): tablet-scherm zonder site-header,
 * altijd light, alleen rol STAFF/ADMIN (proxy geeft al een 307; dit is de
 * belt-and-braces). Breedte 1280px zoals het prototype.
 */
export default async function KitchenLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireStaffPage(locale);
  return (
    <div className="cc-kitchen" style={{ colorScheme: "light" }}>
      <style>{`
        body > header, footer { display: none !important; }
        main { padding: 0 !important; background: #F6F4F5; }
        .cc-kitchen { --ink: #1F1F22; --ink-2: #5E5C61; --ink-3: #8E8A90; --line: #E7E3E6; --wash: #F6F4F5; --red: #F2202B; --red-dark: #8C1420; --red-soft: #FCE9E8; --green: #1E8E4E; --green-soft: #E4F5EA; --amber: #B7791F; --amber-soft: #FFF4DC;
          min-height: 100vh; background: var(--wash); color: var(--ink); font-size: 15px; }
        .cc-kitchen .btn-grad { background: linear-gradient(100deg, #8C1420 0%, #C51A25 55%, #F2202B 100%); color: #fff; }
      `}</style>
      {children}
    </div>
  );
}
