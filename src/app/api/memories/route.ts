import { NextRequest } from "next/server";
import { handleApi } from "@/server/api";
import { requireFamilyAuth } from "@/server/auth/guard";
import { getFamilyMemory, saveFamilyMemory, toMemoryDTO } from "@/server/services/memories.service";
import { invalid } from "@/server/errors";

export async function GET(req: NextRequest) {
  return handleApi(async () => {
    const ctx = await requireFamilyAuth();
    const url = new URL(req.url);
    const query = url.searchParams.get("query") || undefined;
    const category = url.searchParams.get("category") || undefined;

    const memories = await getFamilyMemory(ctx.familyId, { query, category });
    return memories.map(toMemoryDTO);
  });
}

export async function POST(req: NextRequest) {
  return handleApi(async () => {
    const ctx = await requireFamilyAuth();
    const body = await req.json().catch(() => ({}));
    if (!body.content) throw invalid("Memory content cannot be empty");

    const memory = await saveFamilyMemory(ctx, {
      content: body.content,
      category: body.category,
      source: "manual",
    });

    return toMemoryDTO(memory);
  });
}
