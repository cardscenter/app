/**
 * Auth-pages layout (design-pass Fase D): de footer blijft verborgen zodat
 * het scherm rustig is; het kader met ballonnen en de witte punch-card komt
 * van <AuthFrame> in elke page. Scrollen mag (registratie is langer).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`body footer { display: none !important; }`}</style>
      {children}
    </>
  );
}
