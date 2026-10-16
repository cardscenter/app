import { setRequestLocale } from "next-intl/server";
import { AuthFrame } from "@/components/ploy/auth-frame";
import { LoginForm } from "./login-form";

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <AuthFrame>
      <LoginForm locale={locale} />
    </AuthFrame>
  );
}
