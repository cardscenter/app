import { auth } from "@/lib/auth";
import { getVerificationStatus } from "@/actions/verification";
import { getTranslations } from "next-intl/server";
import { VerificationForm } from "@/components/dashboard/verification-form";

export default async function VerificationPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const t = await getTranslations("verification");

  const status = await getVerificationStatus();
  if (!status) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        {t("title")}
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        {t("description")}
      </p>

      {status.status === "APPROVED" && (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-900/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-green-800 dark:text-green-300">{t("verified")}</h3>
              <p className="text-sm text-green-600 dark:text-green-400">
                {t("verifiedDescription")}
              </p>
              {status.reviewedAt && (
                <p className="mt-1 text-xs text-green-500">
                  {t("verifiedOn")} {new Date(status.reviewedAt).toLocaleDateString("nl-NL")}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {status.status === "PENDING" && (
        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-900/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
              <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-blue-800 dark:text-blue-300">{t("pending")}</h3>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                {t("pendingDescription")}
              </p>
              {status.submittedAt && (
                <p className="mt-1 text-xs text-blue-500">
                  {t("submittedOn")} {new Date(status.submittedAt).toLocaleDateString("nl-NL")}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {status.status === "REJECTED" && (
        <div className="mt-6 space-y-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-red-800 dark:text-red-300">{t("rejected")}</h3>
                {status.rejectReason && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {t("reason")}: {status.rejectReason}
                  </p>
                )}
              </div>
            </div>
          </div>
          <VerificationForm />
        </div>
      )}

      {status.status === "NONE" && (
        <div className="mt-6">
          <VerificationForm />
        </div>
      )}
    </div>
  );
}
