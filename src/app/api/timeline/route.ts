import { handleApi } from "@/server/api";
import { requireFamilyAuth } from "@/server/auth/guard";
import { collections } from "@/server/db/client";
import type { ActivityDTO } from "@/lib/types";

export async function GET() {
  return handleApi(async (): Promise<ActivityDTO[]> => {
    const ctx = await requireFamilyAuth();
    const { activity } = await collections();

    const items = await activity
      .find({ familyId: ctx.familyId })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return items.map((a) => ({
      id: a._id.toHexString(),
      actorName: a.actorName,
      type: a.type,
      summary: a.summary,
      entityType: a.entityType,
      entityId: a.entityId ? a.entityId.toHexString() : null,
      createdAt: a.createdAt.toISOString(),
    }));
  });
}
