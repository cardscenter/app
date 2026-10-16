import { setRequestLocale } from "next-intl/server";
import { AuthFrame } from "@/components/ploy/auth-frame";
import { RegisterForm } from "./register-form";
import { listEnabledGames } from "@/lib/games-server";

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const games = await listEnabledGames();
  return (
    <AuthFrame width="lg">
      <RegisterForm games={games} />
    </AuthFrame>
  );
}
