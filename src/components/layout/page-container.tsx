import { cn } from "@/lib/utils";

type Width = "narrow" | "default" | "wide";

const WIDTH_CLASSES: Record<Width, string> = {
  narrow: "max-w-3xl",
  default: "max-w-[1440px]",
  wide: "max-w-[1680px]",
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
        "mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-10",
        WIDTH_CLASSES[width],
        className,
      )}
    >
      {children}
    </Component>
  );
}
