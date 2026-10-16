// Schermvullende kolom voor de berichten-pagina's: de layout lockt html/body
// op viewport-hoogte en maakt <main> een flex-kolom, dus h-full + flex-1 vult
// precies de ruimte onder de site-header (geen page-scroll, geen footer).
// Zelfde 1880px-frame als header/footer/dashboard, gecentreerd.
export function MessagesFrame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex h-full min-h-0 w-full max-w-[1400px] flex-1 flex-col pt-2">{children}</div>;
}
