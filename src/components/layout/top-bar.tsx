import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { HelpCircle } from "lucide-react";
import { WebwinkelkeurWidget } from "@/components/layout/webwinkelkeur-widget";

export function TopBar() {
  const t = useTranslations("topbar");

  return (
    <div className="hidden border-b border-border bg-muted/60 text-xs text-muted-foreground sm:block">
      <div className="mx-auto flex h-8 w-full max-w-[1680px] items-center justify-end gap-4 px-4 sm:px-6 lg:px-8 xl:px-10">
        {/* Live Webwinkelkeur rating */}
        <div className="flex items-center">
          <WebwinkelkeurWidget />
        </div>
        <span aria-hidden className="text-border">·</span>
        <Link
          href="/help"
          className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
        >
          <HelpCircle className="size-3.5" />
          <span>{t("support")}</span>
        </Link>
      </div>
    </div>
  );
}
