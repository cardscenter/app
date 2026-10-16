import { AuthFrame } from "@/components/ploy/auth-frame";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthFrame>
      <ResetPasswordForm token={token ?? ""} />
    </AuthFrame>
  );
}
