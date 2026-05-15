import { setRequestLocale } from "next-intl/server";
import { AuthMarketingAside } from "@/components/auth/auth-marketing-aside";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <LoginForm locale={locale} />
      <AuthMarketingAside variant="login" />
    </>
  );
}
