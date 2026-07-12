import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { LifeBuoy, Mail, MessageCircle, BookOpen } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Support — Cards Center",
};

/**
 * Support-stub (Fase 16-followup). De "support ticket"-links in e-mail-footers
 * wijzen hierheen — zodra er een echt ticketsysteem is vervangt dat deze
 * pagina op dezelfde URL, zodat oude mails blijven kloppen.
 */
export default function SupportPage() {
  return (
    <PageContainer width="narrow" className="py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <LifeBuoy className="size-7" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">Support</h1>
        <p className="mt-2 text-muted-foreground">
          Hulp nodig? We helpen je graag verder.
        </p>
      </div>

      <div className="space-y-4">
        <SupportCard
          icon={<Mail className="size-5" />}
          title="Open een support ticket"
          badge="Binnenkort"
        >
          Ons ticketsysteem is in aanbouw. Tot die tijd kun je ons bereiken via{" "}
          <a
            href="mailto:info@poke-center.nl"
            className="font-medium text-primary underline underline-offset-2 hover:text-primary-hover"
          >
            info@poke-center.nl
          </a>
          . Vermeld je gebruikersnaam en (bij vragen over een bestelling) het
          bestelnummer — dan kunnen we je sneller helpen.
        </SupportCard>

        <SupportCard icon={<MessageCircle className="size-5" />} title="Vraag over een bestelling of item?">
          Neem eerst contact op met de verkoper via de chat op de item-pagina —
          de meeste vragen zijn zo het snelst opgelost. Kom je er samen niet
          uit, dan kun je bij een betaalde bestelling een{" "}
          <Link
            href="/dashboard/geschillen"
            className="font-medium text-primary underline underline-offset-2 hover:text-primary-hover"
          >
            geschil openen
          </Link>{" "}
          — wij bemiddelen dan.
        </SupportCard>

        <SupportCard icon={<BookOpen className="size-5" />} title="Veelgestelde vragen">
          Antwoorden op de meest gestelde vragen over kopen, verkopen,
          verzending en uitbetalingen vind je op de{" "}
          <Link
            href="/"
            className="font-medium text-primary underline underline-offset-2 hover:text-primary-hover"
          >
            homepage
          </Link>{" "}
          onder &ldquo;Veelgestelde vragen&rdquo;.
        </SupportCard>
      </div>
    </PageContainer>
  );
}

function SupportCard({
  icon,
  title,
  badge,
  children,
}: {
  icon: ReactNode;
  title: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="mb-2 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </span>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {badge && (
          <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {badge}
          </span>
        )}
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
    </section>
  );
}
