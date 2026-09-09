import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { LifeBuoy, Mail, MessageCircle, BookOpen, Zap } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasFeature } from "@/lib/subscription-tiers";
import { Link } from "@/i18n/navigation";
import type { ReactNode } from "react";
import { PLATFORM } from "@/lib/platform-config";
import { CompanyIdentity } from "@/components/legal/company-identity";

export const metadata: Metadata = {
  title: "Support — Cards Center",
};

/**
 * Support-/contactpagina. De "Neem contact op"-links in e-mail-footers wijzen
 * hierheen. Contact loopt via e-mail (noreply-model: de afzender van
 * notificatie-mails wordt niet gelezen). Komt er later een ticketsysteem, dan
 * vervangt dat deze pagina op dezelfde URL zodat oude mails blijven kloppen.
 */
export default async function SupportPage() {
  // Voorrang bij support (tier-feature prioritySupport, Fase 45): Unlimited+/
  // Enterprise/Admin krijgen bovenaan een prioriteitskaart met een herkenbaar
  // onderwerp-voorvoegsel zodat de mail in de inbox vooraan gesorteerd kan
  // worden. Voor anderen verandert er niets.
  const session = await auth();
  const me = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { accountType: true, displayName: true },
      })
    : null;
  const priority = me ? hasFeature(me.accountType, "prioritySupport") : false;
  const priorityMailto = me
    ? `mailto:${PLATFORM.supportEmail}?subject=${encodeURIComponent(`[Voorrang] Vraag van ${me.displayName}`)}`
    : null;

  return (
    <PageContainer width="narrow" className="py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <LifeBuoy className="size-7" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">Support &amp; contact</h1>
        <p className="mt-2 text-muted-foreground">
          Hulp nodig? We helpen je graag verder.
        </p>
      </div>

      <div className="space-y-4">
        {priority && priorityMailto && (
          <section className="rounded-2xl border border-primary/40 bg-primary/5 p-5 shadow-card">
            <div className="mb-2 flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Zap className="size-5" />
              </span>
              <h2 className="text-base font-semibold text-foreground">Voorrang-support</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Als Unlimited- of Enterprise-verkoper wordt je vraag met voorrang behandeld, ook bij
              geschillen. Mail ons via{" "}
              <a
                href={priorityMailto}
                className="font-medium text-primary underline underline-offset-2 hover:text-primary-hover"
              >
                {PLATFORM.supportEmail}
              </a>{" "}
              met het onderwerp <span className="font-medium text-foreground">[Voorrang] …</span> — die
              link vult het voor je in.
            </p>
          </section>
        )}

        <SupportCard icon={<Mail className="size-5" />} title="Neem contact op">
          Mail ons op{" "}
          <a
            href={`mailto:${PLATFORM.supportEmail}`}
            className="font-medium text-primary underline underline-offset-2 hover:text-primary-hover"
          >
            {PLATFORM.supportEmail}
          </a>
          . Vermeld je gebruikersnaam en (bij vragen over een bestelling) het
          bestelnummer — dan kunnen we je sneller helpen. We reageren doorgaans
          binnen twee werkdagen.
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
          verzending en uitbetalingen vind je in de{" "}
          <Link
            href="/#faq"
            className="font-medium text-primary underline underline-offset-2 hover:text-primary-hover"
          >
            veelgestelde vragen op de homepage
          </Link>
          .
        </SupportCard>

        <CompanyIdentity heading="Bedrijfsgegevens" />
      </div>
    </PageContainer>
  );
}

function SupportCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="mb-2 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </span>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
    </section>
  );
}
