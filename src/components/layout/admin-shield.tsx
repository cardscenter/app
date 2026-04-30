"use client";

import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Shield } from "lucide-react";

export function AdminShield() {
  const { data: session } = useSession();
  const t = useTranslations("admin");

  if (session?.user?.accountType !== "ADMIN") return null;

  return (
    <Link
      href="/dashboard/admin"
      title={t("shieldTooltip")}
      className="rounded-md p-2 text-amber-300 transition-colors hover:bg-amber-500/15 hover:text-amber-200"
    >
      <Shield className="h-5 w-5" />
    </Link>
  );
}
