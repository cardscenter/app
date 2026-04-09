import Image from "next/image";

interface SectionDividerProps {
  src?: string;
  className?: string;
}

export function SectionDivider({ src, className }: SectionDividerProps) {
  if (src) {
    return (
      <div className={`w-full flex items-center justify-center py-2 ${className ?? ""}`}>
        <Image
          src={src}
          alt=""
          width={1200}
          height={120}
          className="section-divider w-full max-w-5xl"
        />
      </div>
    );
  }

  // Fallback: gradient line divider
  return (
    <div className={`w-full flex items-center justify-center py-4 ${className ?? ""}`}>
      <div className="w-full max-w-3xl h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </div>
  );
}
