"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/admin-audit";
import { revalidatePath } from "next/cache";

export async function upsertAppConfig(key: string, value: string) {
  const { adminId } = await requireAdmin();

  const trimmedKey = key.trim();
  if (!trimmedKey) return { error: "Key is verplicht" };

  // Validate JSON
  try {
    JSON.parse(value);
  } catch (e) {
    return { error: `Ongeldige JSON: ${e instanceof Error ? e.message : "parse-fout"}` };
  }

  const existing = await prisma.appConfig.findUnique({ where: { key: trimmedKey } });
  const op = existing ? "update" : "create";

  await prisma.appConfig.upsert({
    where: { key: trimmedKey },
    create: { key: trimmedKey, value },
    update: { value },
  });

  await logAdminAction({
    adminId,
    action: "UPDATE_APP_CONFIG",
    targetType: "APP_CONFIG",
    targetId: trimmedKey,
    metadata: { op, oldValue: existing?.value ?? null, newValue: value },
  });

  revalidatePath("/dashboard/admin/config");
  return { success: true };
}

export async function deleteAppConfig(key: string) {
  const { adminId } = await requireAdmin();

  const existing = await prisma.appConfig.findUnique({ where: { key } });
  if (!existing) return { error: "Niet gevonden" };

  await prisma.appConfig.delete({ where: { key } });

  await logAdminAction({
    adminId,
    action: "UPDATE_APP_CONFIG",
    targetType: "APP_CONFIG",
    targetId: key,
    metadata: { op: "delete", oldValue: existing.value },
  });

  revalidatePath("/dashboard/admin/config");
  return { success: true };
}
