"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { updateNewsletterOptIn, updatePrivacySettings } from "@/actions/account";

type Field = "showOnParticipantLists" | "showOnLeaderboards" | "newsletterOptIn";

/**
 * Switch gebonden aan een boolean op het account (Community Hub, Fase 2):
 * optimistic flip, server action in transition, terugdraaien bij fout.
 */
export function AccountToggle({ id, field, initialValue }: { id?: string; field: Field; initialValue: boolean }) {
  const [checked, setChecked] = useState(initialValue);
  const [pending, startTransition] = useTransition();

  function handle(value: boolean) {
    const previous = checked;
    setChecked(value);
    startTransition(async () => {
      const res =
        field === "newsletterOptIn"
          ? await updateNewsletterOptIn(value)
          : await updatePrivacySettings({ [field]: value });
      if (res && "error" in res) setChecked(previous);
    });
  }

  return <Switch id={id} checked={checked} onCheckedChange={handle} disabled={pending} />;
}
