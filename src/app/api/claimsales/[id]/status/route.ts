import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const items = await prisma.claimsaleItem.findMany({
    where: { claimsaleId: id },
    select: { id: true, status: true },
  });

  const statusMap: Record<string, string> = {};
  for (const item of items) {
    statusMap[item.id] = item.status;
  }

  return NextResponse.json({ items: statusMap });
}
