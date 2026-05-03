export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Chat moet exact in de viewport passen — geen page-scroll boven de header.
  // We locken html+body op viewport-hoogte zonder overflow, en zetten main als
  // flex-container zodat de chat-grid (h-full) de resterende ruimte exact pakt.
  // Footer wordt verborgen omdat hij anders onder de viewport-vouw valt.
  return (
    <>
      <style>{`
        html, body { height: 100%; overflow: hidden; }
        body > div, main { min-height: 0; }
        main { display: flex; flex-direction: column; padding: 0 !important; }
        footer { display: none !important; }
      `}</style>
      {children}
    </>
  );
}
