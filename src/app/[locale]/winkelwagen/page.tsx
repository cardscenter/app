import { getTranslations } from "next-intl/server";
import { getCart } from "@/actions/cart";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { CartContent } from "@/components/cart/cart-content";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Link } from "@/i18n/navigation";

export default async function CartPage() {
  const session = await auth();
  if (!session?.user) redirect("/nl/login");

  const t = await getTranslations("cart");
  const tBreadcrumbs = await getTranslations("breadcrumbs");
  const groups = await getCart();

  // Get buyer address info
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { street: true, city: true, country: true },
  });
  const hasAddress = !!(user?.street && user?.city && user?.country);
  const buyerCountry = user?.country ?? null;

  const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs("home"), href: "/" },
          { label: t("title") },
        ]}
      />

      <h1 className="text-2xl font-bold text-foreground">
        {t("title")}
      </h1>

      {totalItems === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <ShoppingCart className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">{t("empty")}</p>
          <Link
            href="/claimsales"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors"
          >
            {t("browseClaimsales")}
          </Link>
        </div>
      ) : (
        <CartContent
          groups={groups}
          buyerCountry={buyerCountry}
          hasAddress={hasAddress}
        />
      )}
    </div>
  );
}
