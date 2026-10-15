import { Archivo, Figtree } from "next/font/google";

const archivo = Archivo({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--cc-f-display", display: "swap" });
const figtree = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--cc-f-body", display: "swap" });

/**
 * Bestelapp-layout (Community Hub, Fase 4). Staat los van de site: geen
 * header/footer, altijd light (eigen palet uit het prototype, geen theme-
 * tokens), eigen lettertypes (Archivo + Figtree). Zelfde verberg-truc als
 * /berichten: header, footer en de ZDivider-strook via CSS weg.
 */
export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`cc-order ${archivo.variable} ${figtree.variable}`} style={{ colorScheme: "light" }}>
      <style>{`
        body > header, footer, main + div { display: none !important; }
        main { padding: 0 !important; background: #FFFFFF; }
        .cc-order {
          --ink: #1F1F22; --ink-2: #5E5C61; --ink-3: #8E8A90; --line: #E7E3E6; --wash: #F6F4F5; --card: #FFFFFF;
          --red-dark: #8C1420; --red: #F2202B; --red-soft: #FCE9E8; --green: #1E8E4E; --green-soft: #E4F5EA; --amber: #B7791F; --amber-soft: #FFF4DC;
          --grad: linear-gradient(100deg, var(--red-dark) 0%, #C51A25 55%, var(--red) 100%);
          min-height: 100vh; background: var(--wash); color: var(--ink);
          font-family: var(--cc-f-body), system-ui, sans-serif; font-size: 15px; line-height: 1.45; -webkit-font-smoothing: antialiased;
        }
        .cc-order h1, .cc-order h2, .cc-order h3, .cc-order .display { font-family: var(--cc-f-display), "Arial Narrow", Arial, sans-serif; letter-spacing: -0.01em; }
        .cc-order input, .cc-order textarea, .cc-order button { font-family: inherit; }
        .cc-order .btn-grad { background: var(--grad); color: #fff; }
        .cc-order .card-frame { border: 1px solid var(--line); box-shadow: 0 1px 2px rgba(31,31,34,.04), 0 6px 18px rgba(31,31,34,.06); }
        .cc-order .no-scrollbar::-webkit-scrollbar { display: none; }
        .cc-order .no-scrollbar { scrollbar-width: none; }
        @keyframes cc-pop { 0% { transform: scale(1); } 40% { transform: scale(1.04); } 100% { transform: scale(1); } }
        .cc-order .pop { animation: cc-pop .35s ease; }
        @keyframes cc-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
        .cc-order .pulse { animation: cc-pulse 1.2s ease-in-out infinite; }
      `}</style>
      {children}
    </div>
  );
}
