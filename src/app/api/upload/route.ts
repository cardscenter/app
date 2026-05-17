import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  saveUploadedFile,
  MODERATION_BLOCKED_PREFIX,
  type UploadContext,
} from "@/lib/upload";

const VALID_CONTEXTS: ReadonlySet<UploadContext> = new Set<UploadContext>([
  "listing",
  "auction",
  "avatar",
  "chat",
  "claimsale",
  "verification",
  "dispute",
  "shipping",
]);

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files") as File[];
  const contextRaw = formData.get("context");
  const context =
    typeof contextRaw === "string" && VALID_CONTEXTS.has(contextRaw as UploadContext)
      ? (contextRaw as UploadContext)
      : undefined;

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
      const url = await saveUploadedFile(file, { context, userId: session.user.id });
      urls.push(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload mislukt";
      if (message.startsWith(MODERATION_BLOCKED_PREFIX)) {
        const reason = message.slice(MODERATION_BLOCKED_PREFIX.length).trim();
        errors.push(
          `Deze foto voldoet niet aan onze richtlijnen${reason ? `: ${reason}` : "."}`,
        );
      } else {
        errors.push(message);
      }
    }
  }

  return NextResponse.json({ urls, errors });
}
