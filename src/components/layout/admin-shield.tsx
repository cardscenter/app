"use client";

import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Shield } from "lucide-react";
import { HEADER_ICON_BTN_ADMIN } from "./header-styles";

export function AdminShield() {
  const { data: session } = useSession();
  const t = useTranslations("admin");

  if (session?.user?.accountType !== "ADMIN") return null;

  return (
    <Link
      href="/dashboard/admin"
      title={t("shieldTooltip")}
      className={HEADER_ICON_BTN_ADMIN}
    >
      <Shield className="h-5 w-5" />
    </Link>
  );
}
