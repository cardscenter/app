import { cn } from "@/lib/utils";

type Width = "narrow" | "default" | "wide";

// Community Hub (besluit Youri 2026-10-16): elke pagina gebruikt de volledige
// header-breedte (1880px + gutter clamp(1rem, 3vw, 4rem)), ook de voorheen
// smallere "narrow" (768px) en "default" (1560px) tiers. De prop blijft
// bestaan zodat een later design per tier weer kan verschillen; tot die tijd
// zijn alle drie gelijk aan de header/footer/homepage-secties.
const WIDTH_CLASSES: Record<Width, string> = {
  narrow: "max-w-[1880px]",
  default: "max-w-[1880px]",
  wide: "max-w-[1880px]",
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
