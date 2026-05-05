"use client";

import { useState } from "react";
import { Info, ChevronDown, Shield, ShieldCheck, Server, Headphones } from "lucide-react";
import { AUCTION_BUYER_PREMIUM_RATE } from "@/lib/auction/fees";

export function AuctionFeeExplainer() {
  const [open, setOpen] = useState(false);
  const ratePct = (AUCTION_BUYER_PREMIUM_RATE * 100).toFixed(0);

  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left text-muted-foreground hover:text-foreground"
      >
        <span className="inline-flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" />
          Cards Center rekent {ratePct}% veilingkosten over het winnende bod
        </span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <Item icon={Shield} title="Bescherming">
            Escrow houdt je betaling vast tot levering bevestigd is, dispute-systeem voor problemen.
          </Item>
          <Item icon={ShieldCheck} title="Anti-fraude">
            Bid-IP-tracking, verified-eis voor bids vanaf €2000, automatische runner-up bij wanbetaling.
          </Item>
          <Item icon={Server} title="Platform">
            Real-time bid-updates, anti-snipe extensies in de laatste 2 minuten, servers + onderhoud.
          </Item>
          <Item icon={Headphones} title="Support">
            Klantenservice voor vragen, klacht-afhandeling.
          </Item>
        </div>
      )}
    </div>
  );
}

function Item({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Shield;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
      <div className="flex-1">
        <span className="font-medium text-foreground">{title}: </span>
        <span className="text-muted-foreground">{children}</span>
      </div>
    </div>
  );
}
