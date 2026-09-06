import { cn } from "@/lib/utils";

type Width = "narrow" | "default" | "wide";

// Full-width-gevoel met een maximum voor ultrawide (sept 2026): wide = 1880px,
// default = 1560px, met een vloeiende gutter clamp(1rem, 3vw, 4rem) i.p.v. de
// vaste px-4/6/8/10-ladder. Header, footer en homepage-secties gebruiken
// dezelfde 1880px + gutter inline (ze zitten in <section>s met eigen bg).
const WIDTH_CLASSES: Record<Width, string> = {
  narrow: "max-w-3xl",
  default: "max-w-[1560px]",
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
