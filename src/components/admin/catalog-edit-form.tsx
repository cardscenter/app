"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Save, Edit2, X } from "lucide-react";
import { PILL_BTN_SM, PILL_RED_SM, INPUT } from "@/components/ploy/tile-styles";

type Field = { name: string; label: string; type?: "text" | "number"; defaultValue?: string };

type Props = {
  fields: Field[];
  // Action either takes formData only (create) or (id, formData) (update)
  action: ((formData: FormData) => Promise<{ success?: boolean; error?: string }>) |
         ((id: string, formData: FormData) => Promise<{ success?: boolean; error?: string }>);
  // If editing existing, pass id; otherwise leave undefined for create
  id?: string;
  // Trigger label
  triggerLabel?: string;
  alwaysOpen?: boolean;
};

export function CatalogEditForm({ fields, action, id, triggerLabel = "Bewerk", alwaysOpen = false }: Props) {
  const [open, setOpen] = useState(alwaysOpen);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = id
        ? await (action as (id: string, fd: FormData) => Promise<{ success?: boolean; error?: string }>)(id, fd)
        : await (action as (fd: FormData) => Promise<{ success?: boolean; error?: string }>)(fd);
      if (result.error) {
        setError(result.error);
      } else {
        if (!alwaysOpen) setOpen(false);
        router.refresh();
        if (!id && e.currentTarget instanceof HTMLFormElement) e.currentTarget.reset();
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={PILL_BTN_SM}
      >
        <Edit2 className="h-3 w-3" /> {triggerLabel}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-[14px] bg-[var(--background)] p-3">
      <div className={`grid gap-2 ${fields.length > 4 ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
        {fields.map((f) => (
          <div key={f.name} className="space-y-1">
            <label className="text-xs font-medium text-foreground">{f.label}</label>
            <input
              name={f.name}
              type={f.type ?? "text"}
              defaultValue={f.defaultValue}
              className={INPUT}
            />
          </div>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        {!alwaysOpen && (
          <button
            type="button"
            onClick={() => { setOpen(false); setError(null); }}
            className={PILL_BTN_SM}
          >
            <X className="h-3 w-3" /> Annuleer
          </button>
        )}
        <button
          type="submit"
          disabled={pending}
          className={`${PILL_RED_SM} disabled:opacity-50`}
        >
          <Save className="h-3 w-3" /> {pending ? "Opslaan…" : "Opslaan"}
        </button>
      </div>
    </form>
  );
}
