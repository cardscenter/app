"use client";

import { Star } from "lucide-react";
import { useState } from "react";

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  readonly?: boolean;
}

const sizes = {
  sm: "h-3.5 w-3.5",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

export function StarRating({ value, onChange, size = "md", readonly = false }: StarRatingProps) {
  const [hovered, setHovered] = useState(0);

  const displayValue = hovered || value;

  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => !readonly && setHovered(0)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          className={`transition-colors ${readonly ? "cursor-default" : "cursor-pointer"}`}
        >
          <Star
            className={`${sizes[size]} ${
              star <= displayValue
                ? "fill-yellow-400 text-yellow-400"
                : "fill-none text-gray-300 dark:text-gray-600"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export function StarRatingDisplay({ value, count, size = "sm" }: { value: number; count?: number; size?: "sm" | "md" | "lg" }) {
  return (
    <div className="flex items-center gap-1.5">
      <StarRating value={Math.round(value)} size={size} readonly />
      <span className="text-sm font-medium text-foreground">{value.toFixed(1)}</span>
      {count !== undefined && (
        <span className="text-sm text-muted-foreground">({count})</span>
      )}
    </div>
  );
}
