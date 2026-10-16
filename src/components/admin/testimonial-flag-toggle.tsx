"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { toggleTestimonialFlag } from "@/actions/admin/testimonials";

/** Schakelaar in de admin-lijst: goedgekeurd (zichtbaar) of uitgelicht (homepage). */
export function TestimonialFlagToggle({ id, flag, value, disabled = false }: { id: string; flag: "approved" | "featured"; value: boolean; disabled?: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(value);
  const [pending, start] = useTransition();
  function toggle() {
    const next = !on;
    setOn(next);
    start(async () => {
      const r = await toggleTestimonialFlag(id, flag, next);
      if ("error" in r) {
        setOn(!next);
        toast.error(r.error);
        return;
      }
      router.refresh();
    });
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled || pending}
      onClick={toggle}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${on ? "bg-primary" : "bg-muted-foreground/30"}`}
      title={flag === "approved" ? "Zichtbaar op /ervaringen" : "Ook op de homepage"}
    >
      <span className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}
