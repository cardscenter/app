import { cn } from "@/lib/utils";

interface EmberIconProps {
  className?: string;
}

export function EmberIcon({ className }: EmberIconProps) {
  return (
    <img
      src="/images/ember/ember_currency_transparent.png"
      alt="Ember"
      className={cn("inline-block shrink-0", className)}
    />
  );
}
