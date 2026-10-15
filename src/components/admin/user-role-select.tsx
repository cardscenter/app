"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { setUserRole } from "@/actions/admin/hub";
import { ROLE_LABELS, type Role } from "@/lib/roles";

/**
 * Rol van een gebruiker zetten (Community Hub, Fase 2): speler of staff.
 * Admin gaat via het accounttype (met 2FA-plicht), dus staat hier niet in.
 */
export function UserRoleSelect({ userId, current, isAdminAccount }: { userId: string; current: string; isAdminAccount: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState<Role>(current === "STAFF" ? "STAFF" : "PLAYER");
  const [pending, startTransition] = useTransition();

  if (isAdminAccount) {
    return <span className="text-sm text-muted-foreground">{ROLE_LABELS.ADMIN} (via accounttype)</span>;
  }

  function change(next: Role) {
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const res = await setUserRole(userId, next);
      if (res && "error" in res) {
        setValue(previous);
        toast.error(res.error);
        return;
      }
      toast.success(`Rol gezet op ${ROLE_LABELS[next]}`);
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <select
        value={value}
        onChange={(e) => change(e.target.value as Role)}
        disabled={pending}
        className="rounded-md border border-border bg-card px-2 py-1 text-sm"
      >
        <option value="PLAYER">{ROLE_LABELS.PLAYER}</option>
        <option value="STAFF">{ROLE_LABELS.STAFF}</option>
      </select>
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
    </span>
  );
}
