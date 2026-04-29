"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Gavel } from "lucide-react";
import { toast } from "sonner";
import { updateMaxRunnerUpAttempts } from "@/actions/profile";

interface RunnerUpSettingsProps {
  current: number;
}

export function RunnerUpSettings({ current }: RunnerUpSettingsProps) {
  const t = useTranslations("profile");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(current);

  const dirty = value !== current;

  function handleSave() {
    startTransition(async () => {
      const result = await updateMaxRunnerUpAttempts(value);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("runnerUpSaved"));
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Gavel className="size-4" />
        <span className="text-sm font-medium">{t("runnerUpTitle")}</span>
      </div>

      <p className="text-xs text-muted-foreground">{t("runnerUpHelp")}</p>

      <div className="flex items-center gap-3">
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={value}
          onChange={(e) => setValue(parseInt(e.target.value))}
          className="flex-1 accent-primary"
        />
        <span className="w-10 text-center text-sm font-semibold text-foreground">{value}</span>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={!dirty || pending}
        className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "..." : t("runnerUpSave")}
      </button>
    </div>
  );
}
