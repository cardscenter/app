/**
 * Auth-pages layout (Fase 37). Viewport-fit op desktop (geen scroll):
 * - body forced naar 100vh + overflow-hidden
 * - footer verborgen (auth-pages krijgen alleen header + content, geen footer-noise)
 * - grid 50/50 op lg+, stacked op mobiel (rechterkolom verborgen op <lg)
 *
 * Pages renderen zelf zowel hun form als hun <AuthMarketingAside variant="..." />
 * zodat elke page de juiste aside-variant kan kiezen.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Viewport-fit overrides — alleen actief op auth-routes omdat dit element
          uit de DOM verdwijnt zodra naar een andere route genavigeerd wordt. */}
      <style>{`
        html, body { height: 100vh; overflow: hidden; }
        body footer { display: none !important; }
      `}</style>
      <div className="grid h-[calc(100vh-4rem)] grid-cols-1 overflow-hidden lg:grid-cols-2">
        {children}
      </div>
    </>
  );
}
