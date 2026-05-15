"use client";

import { useState, useTransition } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { syncUserReservedBalance } from "@/actions/admin/users";

function formatEuro(n: number): string {
  return `€${n.toFixed(2).replace(".", ",")}`;
}

export function ReserveSyncButton({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition();
  const [, setForceRender] = useState(0);

  const handleClick = () => {
    if (!confirm("Vastgehouden saldo opnieuw berekenen op basis van de werkelijke biedingen?")) {
      return;
    }
    startTransition(async () => {
      const result = await syncUserReservedBalance(userId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const verb = result.delta > 0 ? "verhoogd" : result.delta < 0 ? "verlaagd" : "gelijk gebleven";
      toast.success(
        `Saldo gesynchroniseerd — ${formatEuro(result.previousReserved)} → ${formatEuro(result.newReserved)} (${verb})`,
      );
      // revalidatePath in de action ververst de pagina, dus de UI updatet automatisch
      setForceRender((n) => n + 1);
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-amber-700 disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
      Sync nu
    </button>
  );
}
