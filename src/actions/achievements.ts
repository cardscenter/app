"use server";

import { auth } from "@/lib/auth";
import {
  getPendingUnlocks as _getPendingUnlocks,
  acknowledgeAllUnlocks as _acknowledgeAllUnlocks,
  type PendingUnlock,
} from "@/lib/achievements";

export async function getPendingUnlocks(): Promise<PendingUnlock[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  return _getPendingUnlocks(session.user.id);
}

export async function acknowledgeAllUnlocks() {
  const session = await auth();
  if (!session?.user?.id) return { acknowledged: 0 };
  const count = await _acknowledgeAllUnlocks(session.user.id);
  return { acknowledged: count };
}
