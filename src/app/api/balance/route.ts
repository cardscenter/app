import { auth } from "@/lib/auth";
import { assertFeatureForRoute } from "@/lib/feature-flags-server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  // Feature-flag-guard (Community Hub, Fase 1): 404 voor niet-admins zolang FEATURE_WALLET uit staat.
  const blocked = await assertFeatureForRoute("FEATURE_WALLET");
  if (blocked) return blocked;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ balance: null, reservedBalance: null, availableBalance: null }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { balance: true, reservedBalance: true },
  });

  const balance = user?.balance ?? 0;
  const reservedBalance = user?.reservedBalance ?? 0;
  const availableBalance = Math.max(0, balance - reservedBalance);

  return NextResponse.json({ balance, reservedBalance, availableBalance });
}
