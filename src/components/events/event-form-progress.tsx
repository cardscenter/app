"use client";

import { useEffect, useState, useRef } from "react";
import { Check, Tag, FileText, MapPin, ListChecks, Image as ImageIcon, Megaphone } from "lucide-react";

export type EventStepKey = "type" | "details" | "location" | "extras" | "photo" | "promotion";

const STEPS: Array<{ key: EventStepKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "type", label: "Type", icon: Tag },
  { key: "details", label: "Details", icon: FileText },
  { key: "location", label: "Locatie", icon: MapPin },
  { key: "extras", label: "Extra's", icon: ListChecks },
  { key: "photo", label: "Foto", icon: ImageIcon },
  { key: "promotion", label: "Promotie", icon: Megaphone },
];

export function EventFormProgress({ completed }: { completed: Set<EventStepKey> }) {
  const [active, setActive] = useState<EventStepKey>("type");
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const sections = STEPS.map((s) => document.querySelector<HTMLElement>(`[data-section="${s.key}"]`)).filter(
      (el): el is HTMLElement => el !== null,
    );
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (a.target as HTMLElement).offsetTop - (b.target as HTMLElement).offsetTop);
        if (visible.length > 0) {
          const key = (visible[0].target as HTMLElement).dataset.section as EventStepKey;
          setActive(key);
        }
      },
      { rootMargin: "-30% 0px -55% 0px" },
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    chipRefs.current[active]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [active]);

  function scrollTo(key: EventStepKey) {
    document.querySelector(`[data-section="${key}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="sticky top-16 z-10 -mx-1 mb-2 overflow-x-auto bg-background/80 px-1 py-2 backdrop-blur">
      <div className="flex gap-2">
        {STEPS.map((step) => {
          const isDone = completed.has(step.key);
          const isActive = active === step.key;
          const Icon = step.icon;
          return (
            <button
              key={step.key}
              ref={(el) => { chipRefs.current[step.key] = el; }}
              type="button"
              onClick={() => scrollTo(step.key)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : isDone
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {isDone ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              {step.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
