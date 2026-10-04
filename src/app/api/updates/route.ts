import { NextRequest } from "next/server";
import { handleApi } from "@/server/api";
import { requireFamilyAuth } from "@/server/auth/guard";
import { createFamilyUpdate, getFamilyUpdates, toUpdateDTO } from "@/server/services/updates.service";
import { invalid } from "@/server/errors";

export async function GET() {
  return handleApi(async () => {
    const ctx = await requireFamilyAuth();
    const updates = await getFamilyUpdates(ctx.familyId);
    return updates.map(toUpdateDTO);
  });
}

export async function POST(req: NextRequest) {
  return handleApi(async () => {
    const ctx = await requireFamilyAuth();
    const body = await req.json().catch(() => ({}));
    if (!body.content) throw invalid("Update content cannot be empty");

    const update = await createFamilyUpdate(ctx, body.content, "text");
    return toUpdateDTO(update);
  });
}
