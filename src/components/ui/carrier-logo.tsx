import { KNOWN_CARRIERS } from "@/lib/shipping/carriers";
import { Package } from "lucide-react";

interface CarrierLogoProps {
  carrierId: string;
  size?: number;
  className?: string;
}

export function CarrierLogo({ carrierId, size = 20, className = "" }: CarrierLogoProps) {
  const carrier = KNOWN_CARRIERS.find((c) => c.id === carrierId);

  if (!carrier?.logo) {
    return <Package className={`text-muted-foreground ${className}`} style={{ width: size, height: size }} />;
  }

  return (
    <img
      src={carrier.logo}
      alt={carrier.name}
      width={size}
      height={size}
      className={`object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
