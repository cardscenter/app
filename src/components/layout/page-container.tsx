import { cn } from "@/lib/utils";

type Width = "narrow" | "default" | "wide";

// Design-pass 2026-10 (Ploy-stijl): inhoud op 72rem (1152px) zoals de
// referentie; "wide" voor grids en de navigatie-breedte (1400px), "narrow"
// voor leesteksten. Gutter clamp(1rem, 3vw, 4rem).
const WIDTH_CLASSES: Record<Width, string> = {
  narrow: "max-w-3xl",
  default: "max-w-6xl",
  wide: "max-w-[1400px]",
};

export function PageContainer({
  children,
  width = "default",
  className,
  as: Component = "div",
}: {
  children: React.ReactNode;
  width?: Width;
  className?: string;
  as?: "div" | "main" | "section" | "header" | "footer";
}) {
  return (
    <Component
      className={cn(
        "mx-auto w-full px-[clamp(1rem,3vw,4rem)]",
        WIDTH_CLASSES[width],
        className,
      )}
    >
      {children}
    </Component>
  );
}
