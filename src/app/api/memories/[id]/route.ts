import { NextRequest } from "next/server";
import { handleApi } from "@/server/api";
import { requireFamilyAuth } from "@/server/auth/guard";
import { deleteFamilyMemory } from "@/server/services/memories.service";

export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  return handleApi(async () => {
    const ctx = await requireFamilyAuth();
    const { id } = await props.params;
    await deleteFamilyMemory(ctx, id);
    return { success: true };
  });
}
