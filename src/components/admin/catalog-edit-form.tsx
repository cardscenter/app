"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Save, Edit2, X } from "lucide-react";

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
        className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-muted"
      >
        <Edit2 className="h-3 w-3" /> {triggerLabel}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg border border-border bg-muted p-3">
      <div className={`grid gap-2 ${fields.length > 4 ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
        {fields.map((f) => (
          <div key={f.name} className="space-y-1">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground/70">{f.label}</label>
            <input
              name={f.name}
              type={f.type ?? "text"}
              defaultValue={f.defaultValue}
              className="w-full rounded-md border border-border bg-card px-2 py-1 text-sm"
            />
          </div>
        ))}
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex justify-end gap-2">
        {!alwaysOpen && (
          <button
            type="button"
            onClick={() => { setOpen(false); setError(null); }}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-muted"
          >
            <X className="h-3 w-3" /> Annuleer
          </button>
        )}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          <Save className="h-3 w-3" /> {pending ? "Opslaan…" : "Opslaan"}
        </button>
      </div>
    </form>
  );
}
