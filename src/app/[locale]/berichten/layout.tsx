export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`footer { display: none !important; } main { padding-bottom: 0 !important; }`}</style>
      {children}
    </>
  );
}
