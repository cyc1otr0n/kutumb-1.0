import { NextRequest } from "next/server";
import { handleApi } from "@/server/api";
import { requireFamilyAuth } from "@/server/auth/guard";
import { dismissPendingAction } from "@/server/services/actions.service";

export async function POST(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  return handleApi(async () => {
    const ctx = await requireFamilyAuth();
    const { id } = await props.params;
    await dismissPendingAction(ctx, id);
    return { success: true };
  });
}
