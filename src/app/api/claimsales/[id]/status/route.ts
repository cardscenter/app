import { prisma } from "@/lib/prisma";
import { expireClaimedItems } from "@/actions/claimsale";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Lazy expiration: expire stale claims for this claimsale on every poll
  await expireClaimedItems(id);

  const items = await prisma.claimsaleItem.findMany({
    where: { claimsaleId: id },
    select: {
      id: true,
      status: true,
      price: true,
      cardName: true,
      condition: true,
      imageUrls: true,
    },
  });

  let totalAvailable = 0;
  let totalClaimed = 0;
  let totalSold = 0;

  const itemList = items.map((item) => {
    if (item.status === "AVAILABLE") totalAvailable++;
    else if (item.status === "CLAIMED") totalClaimed++;
    else if (item.status === "SOLD") totalSold++;

    return {
      id: item.id,
      status: item.status,
      price: item.price,
      cardName: item.cardName,
      condition: item.condition,
      imageUrls: item.imageUrls,
    };
  });

  return NextResponse.json({
    items: itemList,
    totalAvailable,
    totalClaimed,
    totalSold,
  });
}