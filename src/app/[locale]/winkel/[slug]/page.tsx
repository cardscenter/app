import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

// /winkel/<slug> is een server-side redirect naar de canonical seller-page
// (/verkoper/<userId>). Slug wordt alleen geserveerd als de eigenaar
// momenteel een Unlimited+/Enterprise/Admin tier heeft — bij downgrade
// stopt de redirect (notFound), de slug blijft wel bewaard zodat een
// re-upgrade hem niet verliest.
const ALLOWED_TIERS = ["UNLIMITED", "ENTERPRISE", "ADMIN"];

export default async function ShopVanityRedirect({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  const owner = await prisma.user.findUnique({
    where: { shopSlug: slug.toLowerCase() },
    select: { id: true, accountType: true },
  });

  if (!owner || !ALLOWED_TIERS.includes(owner.accountType)) {
    notFound();
  }

  redirect(`/${locale}/verkoper/${owner.id}`);
}
