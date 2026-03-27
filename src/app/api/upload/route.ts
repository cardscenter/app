import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { saveUploadedFile } from "@/lib/upload";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files") as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: "Geen bestanden geselecteerd" }, { status: 400 });
  }

  if (files.length > 10) {
    return NextResponse.json({ error: "Maximaal 10 bestanden tegelijk" }, { status: 400 });
  }

  const urls: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    try {
      const url = await saveUploadedFile(file);
      urls.push(url);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Upload mislukt");
    }
  }

  return NextResponse.json({ urls, errors });
}
