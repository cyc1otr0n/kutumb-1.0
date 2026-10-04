import { NextRequest } from "next/server";
import { handleApi } from "@/server/api";
import { requireFamilyAuth } from "@/server/auth/guard";
import { confirmPendingAction } from "@/server/services/actions.service";

export async function POST(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  return handleApi(async () => {
    const ctx = await requireFamilyAuth();
    const { id } = await props.params;
    const result = await confirmPendingAction(ctx, id);
    return result;
  });
}
