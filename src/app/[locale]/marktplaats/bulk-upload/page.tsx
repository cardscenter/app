import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasFeature } from "@/lib/subscription-tiers";
import { Upload, Lock, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { BulkUploadWizard } from "@/components/listing/bulk-upload-wizard";
import { PageContainer } from "@/components/layout/page-container";

export default async function BulkUploadPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true },
  });
  if (!user) return null;

  const allowed = hasFeature(user.accountType, "bulkUpload");

  return (
    <PageContainer width="default" className="py-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="rounded-xl bg-sky-500/10 p-3">
          <Upload className="h-6 w-6 text-sky-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bulk-upload (CSV)</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Importeer meerdere listings tegelijk via een CSV-bestand. Foto&apos;s voeg je daarna per listing toe.
          </p>
        </div>
      </div>

      {allowed ? (
        <BulkUploadWizard />
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-border bg-muted/30 p-10 text-center">
          <Lock className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">
            Bulk-upload is een PRO+ feature
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Bespaar uren werk: importeer tot tientallen listings tegelijk via Excel of Google Sheets export.
          </p>
          <Link
            href="/dashboard/abonnement"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white"
          >
            Bekijk abonnementen
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </PageContainer>
  );
}
