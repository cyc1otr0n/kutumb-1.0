import { NextRequest } from "next/server";
import { handleApi } from "@/server/api";
import { requireFamilyAuth } from "@/server/auth/guard";
import { executeKutumbQuery } from "@/server/agent/kutumb.agent";
import { invalid } from "@/server/errors";

export async function POST(req: NextRequest) {
  return handleApi(async () => {
    const ctx = await requireFamilyAuth();
    const body = await req.json().catch(() => ({}));
    const query = body.query;
    if (!query || typeof query !== "string" || !query.trim()) {
      throw invalid("Query cannot be empty");
    }

    const response = await executeKutumbQuery(ctx, query.trim(), "ask");
    return response;
  });
}
