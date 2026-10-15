import { setRequestLocale } from "next-intl/server";
import { AuthMarketingAside } from "@/components/auth/auth-marketing-aside";
import { RegisterForm } from "./register-form";
import { listEnabledGames } from "@/lib/games-server";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const games = await listEnabledGames();

  return (
    <>
      <div className="flex h-full items-start justify-center overflow-y-auto bg-background px-4 py-8 sm:px-8 lg:items-center lg:px-12">
        <RegisterForm games={games} />
      </div>
      <AuthMarketingAside variant="register" />
    </>
  );
}
