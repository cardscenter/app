import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";

interface EmptyHomeSectionProps {
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  bgClass?: string;
}

export function EmptyHomeSection({
  icon,
  iconClass,
  title,
  description,
  ctaLabel,
  ctaHref,
  bgClass = "bg-background",
}: EmptyHomeSectionProps) {
  return (
    <section className={`py-12 lg:py-16 ${bgClass}`}>
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-border bg-card/40 px-6 py-10 text-center sm:px-12 sm:py-14">
          <div className={`mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl ${iconClass}`}>
            {icon}
          </div>
          <h3 className="mt-5 text-xl font-semibold text-foreground sm:text-2xl">
            {title}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
          <Link
            href={ctaHref}
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-foreground/85"
          >
            {ctaLabel}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
