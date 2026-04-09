import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

interface SectionHeaderProps {
  icon: ReactNode;
  iconClass: string;
  titleKey: string;
  descriptionKey?: string;
  href?: string;
  linkColor?: string;
}

export function SectionHeader({ icon, iconClass, titleKey, descriptionKey, href, linkColor }: SectionHeaderProps) {
  const t = useTranslations("home");
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconClass}`}>
          {icon}
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{t(titleKey)}</h2>
          {descriptionKey && (
            <p className="text-sm text-muted-foreground">{t(descriptionKey)}</p>
          )}
        </div>
      </div>
      {href && (
        <Link
          href={href}
          className={`inline-flex items-center gap-1 text-sm font-medium transition-colors ${linkColor ?? "text-primary hover:text-primary-hover"}`}
        >
          {t("viewAll")} <ArrowRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}
