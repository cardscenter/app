export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Berichten staan op zichzelf (geen dashboard-sidebar) en moeten exact in
  // de viewport passen — geen page-scroll onder de header. We locken
  // html+body op viewport-hoogte zonder overflow, en zetten main als
  // flex-container zodat de chat (h-full) de resterende ruimte exact pakt.
  // Footer wordt verborgen omdat hij anders onder de viewport-vouw valt.
  return (
    <>
      <style>{`
        html, body { height: 100%; overflow: hidden; }
        body > div, main { min-height: 0; }
        main { display: flex; flex-direction: column; padding-bottom: 0 !important; }
        footer { display: none !important; }
      `}</style>
      {children}
    </>
  );
}
