import { handleApi } from "@/server/api";
import { requireFamilyAuth } from "@/server/auth/guard";
import { generateDailyDigest, getLatestDigest, toDigestDTO } from "@/server/services/digest.service";

export async function GET() {
  return handleApi(async () => {
    const ctx = await requireFamilyAuth();
    let digest = await getLatestDigest(ctx.familyId);
    if (!digest) {
      digest = await generateDailyDigest(ctx);
    }
    return toDigestDTO(digest);
  });
}

export async function POST() {
  return handleApi(async () => {
    const ctx = await requireFamilyAuth();
    const digest = await generateDailyDigest(ctx);
    return toDigestDTO(digest);
  });
}
