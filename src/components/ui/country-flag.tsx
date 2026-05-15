import { cn } from "@/lib/utils";

export type FlagSize = "xs" | "sm" | "md" | "lg";

interface CountryFlagProps {
  /** ISO 3166-1 alpha-2 country code (NL/BE/DE/...) of "EU" voor de Europese Unie. Case-insensitive. */
  code: string | null | undefined;
  size?: FlagSize;
  /** Optionele extra classes voor de wrapper. */
  className?: string;
  /** Toon als rond pictogram i.p.v. rechthoek (3:2). */
  rounded?: boolean;
  /** Toegankelijkheidslabel; default = code in hoofdletters. */
  title?: string;
}

const SIZE_CLASSES: Record<FlagSize, string> = {
  xs: "w-3.5 h-[10.5px]",
  sm: "w-4 h-3",
  md: "w-5 h-[15px]",
  lg: "w-6 h-[18px]",
};

const ROUNDED_SIZE_CLASSES: Record<FlagSize, string> = {
  xs: "w-3.5 h-3.5",
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
};

/** SVG vlag via flag-icons CSS library. Render `<CountryFlag code="NL" />`
 *  voor een ISO landcode, of `<CountryFlag code="EU" />` voor de EU-vlag.
 *  Returnt null bij ontbrekende code zodat callers ?? "" niet hoeven. */
export function CountryFlag({
  code,
  size = "sm",
  className,
  rounded = false,
  title,
}: CountryFlagProps) {
  if (!code) return null;
  const normalized = code.trim().toLowerCase();
  if (!normalized) return null;
  const sizeClasses = rounded ? ROUNDED_SIZE_CLASSES[size] : SIZE_CLASSES[size];
  return (
    <span
      className={cn(
        "fi inline-block shrink-0 align-[-0.125em] bg-cover bg-center",
        `fi-${normalized}`,
        rounded && "fis rounded-full",
        sizeClasses,
        className,
      )}
      title={title ?? code.toUpperCase()}
      aria-label={title ?? code.toUpperCase()}
      role="img"
    />
  );
}
