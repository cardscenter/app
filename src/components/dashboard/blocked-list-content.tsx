"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { unblockUser } from "@/actions/block-report";

import { PILL_BTN_SM } from "@/components/ploy/tile-styles";
interface Row {
  id: string;
  blockedId: string;
  displayName: string;
  avatarUrl: string | null;
  reason: string | null;
  createdAt: string;
}

export function BlockedListContent({ rows }: { rows: Row[] }) {
  const t = useTranslations("blockReport");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [removing, setRemoving] = useState<string | null>(null);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noBlockedUsers")}</p>;
  }

  function handleUnblock(blockedId: string) {
    setRemoving(blockedId);
    startTransition(async () => {
      const result = await unblockUser(blockedId);
      setRemoving(null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("unblocked"));
      router.refresh();
    });
  }

  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li
          key={r.id}
          className="flex items-center justify-between gap-3 dash-card p-4"
        >
          <div className="flex items-center gap-3">
            <div className="relative size-10 overflow-hidden rounded-[22%] bg-muted">
              {r.avatarUrl && (
                <Image src={r.avatarUrl} alt={r.displayName} fill className="object-cover" sizes="40px" />
              )}
            </div>
            <div>
              <p className="font-medium text-foreground">{r.displayName}</p>
              {r.reason && <p className="text-xs text-muted-foreground">{r.reason}</p>}
              <p className="text-xs text-muted-foreground">
                {new Date(r.createdAt).toLocaleDateString("nl-NL", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleUnblock(r.blockedId)}
            disabled={pending && removing === r.blockedId}
            className={`${PILL_BTN_SM} disabled:opacity-50`}
          >
            {removing === r.blockedId ? "..." : t("unblockButton")}
          </button>
        </li>
      ))}
    </ul>
  );
}
