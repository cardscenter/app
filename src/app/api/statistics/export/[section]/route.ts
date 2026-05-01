import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import {
  fetchSalesData,
  fetchBuyerData,
  fetchSellerPerformance,
  fetchCommissionData,
  fetchXPData,
} from "@/lib/statistics-queries";
import { getPeriodDates } from "@/lib/statistics-helpers";
import { calculateXP } from "@/lib/seller-levels";
import {
  buildSalesCsv,
  buildBuyerCsv,
  buildPerformanceCsv,
  buildCommissionCsv,
  buildXpCsv,
} from "@/lib/csv-export";

const VALID_SECTIONS = ["sales", "buyer", "performance", "commission", "xp"] as const;
type Section = (typeof VALID_SECTIONS)[number];

function isValidSection(s: string): s is Section {
  return (VALID_SECTIONS as readonly string[]).includes(s);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ section: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true },
  });

  if (!user || user.accountType === "FREE") {
    return NextResponse.json({ error: "Premium required" }, { status: 403 });
  }

  const { section } = await params;
  if (!isValidSection(section)) {
    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  }

  const url = new URL(request.url);
  const period = url.searchParams.get("period") ?? "90d";
  const { start } = getPeriodDates(period);

  let csv: string;
  switch (section) {
    case "sales": {
      const data = await fetchSalesData(session.user.id, start);
      csv = buildSalesCsv(data);
      break;
    }
    case "buyer": {
      const data = await fetchBuyerData(session.user.id, start);
      csv = buildBuyerCsv(data);
      break;
    }
    case "performance": {
      const data = await fetchSellerPerformance(session.user.id, start);
      csv = buildPerformanceCsv(data.reviews);
      break;
    }
    case "commission": {
      const data = await fetchCommissionData(session.user.id, start);
      csv = buildCommissionCsv(data);
      break;
    }
    case "xp": {
      const xpRaw = await fetchXPData(session.user.id);
      if (!xpRaw) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      csv = buildXpCsv(calculateXP(xpRaw));
      break;
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const filename = `${section}-${period}-${today}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
