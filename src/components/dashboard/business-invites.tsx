"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { respondToBusinessInvite, removeBusinessMember } from "@/actions/business-team";
import { UserAvatar } from "@/components/ui/user-avatar";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import { buttonVariants } from "@/components/ui/button-variants";

export type MembershipRow = {
  id: string;
  businessId: string;
  companyName: string;
  avatarUrl: string | null;
  title: string | null;
  status: string;
};

/**
 * Kant van de (persoonlijke) gebruiker (profiel-redesign sept 2026): open
 * team-uitnodigingen accepteren/afwijzen en bestaande lidmaatschappen
 * ("Werkt bij …") verlaten. Rendert in de control-kolom van een FieldRow.
 */
export function BusinessInvites({ rows }: { rows: MembershipRow[] }) {
  const t = useTranslations("profile");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function respond(id: string, accept: boolean) {
    startTransition(async () => {
      const result = await respondToBusinessInvite(id, accept);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(accept ? t("teamInviteAccepted") : t("teamInviteDeclined"));
      router.refresh();
    });
  }

  function leave(id: string) {
    startTransition(async () => {
      const result = await removeBusinessMember(id);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("teamLeft"));
      router.refresh();
    });
  }

  return (
    <ul className="divide-y divide-border rounded-[12px] border border-[var(--border)] bg-white">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
          <UserAvatar src={r.avatarUrl} name={r.companyName} size="md" />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 text-sm">
              <Link href={`/spelers/${r.businessId}`} className="font-semibold text-foreground hover:underline">
                {r.companyName}
              </Link>
              {r.status === "PENDING" && <StatusBadge tone="warning">{t("teamInvitePending")}</StatusBadge>}
            </p>
            <p className="text-xs text-muted-foreground">{r.title ?? t("teamMemberRole")}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            {r.status === "PENDING" ? (
              <>
                <button
                  type="button"
                  onClick={() => respond(r.id, true)}
                  disabled={pending}
                  className={buttonVariants({ size: "sm" })}
                >
                  <Check className="size-3.5" />
                  {t("teamAccept")}
                </button>
                <button
                  type="button"
                  onClick={() => respond(r.id, false)}
                  disabled={pending}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <X className="size-3.5" />
                  {t("teamDecline")}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => leave(r.id)}
                disabled={pending}
                className="text-xs font-medium text-muted-foreground hover:text-[var(--destructive)] disabled:opacity-50"
              >
                {t("teamLeave")}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
